import { clamp, smoothValue, safeDivide } from "../utils/math.js";

const DEFAULT_BAND_DEFINITIONS = [
  { label: "sub", min: 20, max: 60 },
  { label: "bass", min: 60, max: 250 },
  { label: "lowMid", min: 250, max: 500 },
  { label: "mid", min: 500, max: 2000 },
  { label: "highMid", min: 2000, max: 6000 },
  { label: "high", min: 6000, max: 16000 }
];
const VALID_FFT_SIZES = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
const DEFAULT_SILENCE_GATE = {
  floorRms: 0.02,
  ceilingRms: 0.1,
  attack: 0.6,
  release: 0.12,
  activationThreshold: 0.12
};

export class AudioFeatureExtractor {
  constructor({
    audioContext,
    analyserNode = null,
    fftSize = 2048,
    bandDefinitions = DEFAULT_BAND_DEFINITIONS,
    rolloffPercent = 0.85,
    silenceGate = DEFAULT_SILENCE_GATE
  }) {
    if (!audioContext) {
      throw new Error("AudioFeatureExtractor requires an AudioContext");
    }

    this.audioContext = audioContext;
    this.analyser = analyserNode ?? audioContext.createAnalyser();

    if (!this.analyser.fftSize) {
      this.analyser.fftSize = fftSize;
    } else if (!analyserNode) {
      this.analyser.fftSize = fftSize;
    }

    if (typeof this.analyser.smoothingTimeConstant === "number" && !analyserNode) {
      this.analyser.smoothingTimeConstant = 0.8;
    }

    this.fftSize = this.analyser.fftSize;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.fftSize);
    this.bandDefinitions = this._normalizeBands(bandDefinitions);
    this.rolloffPercent = clamp(rolloffPercent, 0, 1);
    this._latestFrame = null;
    this.silenceGate = this._normalizeSilenceGate(silenceGate);
    this._activityLevel = 0;
  }

  getAnalyserNode() {
    return this.analyser;
  }

  getLatestFrame() {
    return this._latestFrame;
  }

  setFftSize(nextSize) {
    const target = this._coerceFftSize(nextSize);
    if (!target || target === this.fftSize) {
      return false;
    }
    this.analyser.fftSize = target;
    this.fftSize = target;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.fftSize);
    return true;
  }

  update() {
    if (!this.analyser) {
      return null;
    }

    this.analyser.getByteTimeDomainData(this.timeDomainData);
    this.analyser.getByteFrequencyData(this.frequencyData);

    const frame = this._computeFrame();
    this._latestFrame = frame;
    return frame;
  }

  _computeFrame() {
    const rmsResult = this._computeRmsAndPeak();
    const {
      bands,
      averageEnergy,
      centroid,
      rolloff,
      centroidNormalized,
      rolloffNormalized,
      nyquist
    } = this._computeFrequencyFeatures();
    const timestamp = typeof performance !== "undefined" ? performance.now() : Date.now();
    const activity = this._updateActivityLevel(rmsResult.rms);

    const frame = {
      timestamp,
      rms: rmsResult.rms,
      peak: rmsResult.peak,
      bands,
      bandLabels: this.bandDefinitions.map((band) => band.label),
      centroid: centroidNormalized,
      centroidHz: centroid,
      rolloff: rolloffNormalized,
      rolloffHz: rolloff,
      nyquist,
      energy: averageEnergy,
      activity
    };
    const isActive = activity >= this.silenceGate.activationThreshold;
    frame.isActive = isActive;
    if (!isActive) {
      frame.rms = 0;
      frame.peak = 0;
      frame.energy = 0;
      frame.centroid = 0;
      frame.centroidHz = 0;
      frame.rolloff = 0;
      frame.rolloffHz = 0;
      frame.bands = new Array(frame.bands.length).fill(0);
    }

    return frame;
  }

  _computeRmsAndPeak() {
    let sumSquares = 0;
    let peak = 0;
    const samples = this.timeDomainData.length;

    for (let i = 0; i < samples; i += 1) {
      const normalized = (this.timeDomainData[i] - 128) / 128;
      peak = Math.max(peak, Math.abs(normalized));
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / samples);
    return { rms, peak };
  }

  _computeFrequencyFeatures() {
    const binCount = this.analyser.frequencyBinCount;
    if (!binCount) {
      const nyquist = this.audioContext.sampleRate / 2;
      return {
        bands: new Array(this.bandDefinitions.length).fill(0),
        averageEnergy: 0,
        centroid: 0,
        centroidNormalized: 0,
        rolloff: 0,
        rolloffNormalized: 0,
        nyquist
      };
    }

    const normalized = new Float32Array(binCount);
    let totalEnergy = 0;
    for (let i = 0; i < binCount; i += 1) {
      const value = this.frequencyData[i] / 255;
      normalized[i] = value;
      totalEnergy += value;
    }

    const bandValues = this._computeBands(normalized);
    const freqResolution = this.audioContext.sampleRate / this.fftSize;
    const weightedSum = normalized.reduce((sum, value, index) => {
      const frequency = index * freqResolution;
      return sum + frequency * value;
    }, 0);
    const centroid = safeDivide(weightedSum, totalEnergy);
    const nyquist = this.audioContext.sampleRate / 2;
    const centroidNormalized = clamp(safeDivide(centroid, nyquist), 0, 1);

    const rolloffThreshold = totalEnergy * this.rolloffPercent;
    let accumulated = 0;
    let rolloffFrequency = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      accumulated += normalized[i];
      if (accumulated >= rolloffThreshold) {
        rolloffFrequency = i * freqResolution;
        break;
      }
    }

    const averageEnergy = normalized.length ? totalEnergy / normalized.length : 0;
    const rolloffNormalized = clamp(safeDivide(rolloffFrequency, nyquist), 0, 1);

    return {
      bands: bandValues,
      averageEnergy,
      centroid,
      centroidNormalized,
      rolloff: rolloffFrequency,
      rolloffNormalized,
      nyquist
    };
  }

  _computeBands(normalizedFrequencyData) {
    const freqResolution = this.audioContext.sampleRate / this.fftSize;
    const lastIndex = normalizedFrequencyData.length - 1;

    return this.bandDefinitions.map((band) => {
      const minIndex = clamp(Math.ceil(band.min / freqResolution), 0, lastIndex);
      const maxIndex = clamp(Math.floor(band.max / freqResolution), 0, lastIndex);
      const inclusiveMax = Math.max(minIndex, maxIndex);
      let sum = 0;
      let count = 0;
      for (let i = minIndex; i <= inclusiveMax; i += 1) {
        sum += normalizedFrequencyData[i];
        count += 1;
      }
      return count > 0 ? sum / count : 0;
    });
  }

  _normalizeBands(definitions) {
    const nyquist = this.audioContext.sampleRate / 2;
    return definitions.map((band, index) => {
      const min = clamp(band.min ?? band.range?.[0] ?? 0, 0, nyquist);
      const maxCandidate = band.max ?? band.range?.[1] ?? nyquist;
      const max = clamp(maxCandidate, min, nyquist);
      return {
        label: band.label ?? `band${index}`,
        min,
        max
      };
    });
  }

  _coerceFftSize(candidate) {
    const numeric = Number(candidate);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    const clamped = clamp(Math.round(numeric), VALID_FFT_SIZES[0], VALID_FFT_SIZES[VALID_FFT_SIZES.length - 1]);
    let closest = VALID_FFT_SIZES[0];
    let closestDelta = Math.abs(clamped - closest);
    for (let i = 1; i < VALID_FFT_SIZES.length; i += 1) {
      const value = VALID_FFT_SIZES[i];
      const delta = Math.abs(clamped - value);
      if (delta < closestDelta) {
        closest = value;
        closestDelta = delta;
      }
    }
    return closest;
  }

  _normalizeSilenceGate(config = {}) {
    const floor = Number.isFinite(config.floorRms) ? Math.max(0, config.floorRms) : DEFAULT_SILENCE_GATE.floorRms;
    const minCeiling = floor + 0.001;
    const rawCeiling = Number.isFinite(config.ceilingRms) ? Math.max(minCeiling, config.ceilingRms) : DEFAULT_SILENCE_GATE.ceilingRms;
    const attack = clamp(
      Number.isFinite(config.attack) ? config.attack : DEFAULT_SILENCE_GATE.attack,
      0,
      0.99
    );
    const release = clamp(
      Number.isFinite(config.release) ? config.release : DEFAULT_SILENCE_GATE.release,
      0,
      0.99
    );
    return {
      floorRms: floor,
      ceilingRms: rawCeiling,
      attack,
      release,
      activationThreshold: clamp(
        Number.isFinite(config.activationThreshold)
          ? config.activationThreshold
          : DEFAULT_SILENCE_GATE.activationThreshold,
        0,
        1
      )
    };
  }

  _updateActivityLevel(rmsValue) {
    const normalized = this._normalizeActivity(rmsValue);
    const smoothing =
      normalized > this._activityLevel ? this.silenceGate.attack : this.silenceGate.release;
    const next = smoothValue(this._activityLevel, normalized, smoothing);
    this._activityLevel = clamp(next, 0, 1);
    return this._activityLevel;
  }

  _normalizeActivity(rmsValue) {
    if (!Number.isFinite(rmsValue)) {
      return 0;
    }
    const { floorRms, ceilingRms } = this.silenceGate;
    if (rmsValue <= floorRms) {
      return 0;
    }
    if (rmsValue >= ceilingRms) {
      return 1;
    }
    return (rmsValue - floorRms) / (ceilingRms - floorRms);
  }
}

export { DEFAULT_BAND_DEFINITIONS };
