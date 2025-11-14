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

export class AudioFeatureExtractor {
  constructor({
    audioContext,
    analyserNode = null,
    fftSize = 2048,
    bandDefinitions = DEFAULT_BAND_DEFINITIONS,
    rolloffPercent = 0.85,
    featureSmoothing = 0.65
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
    this.featureSmoothing = clamp(featureSmoothing, 0, 0.99);
    this._latestFrame = null;
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
    const { bands, averageEnergy, centroid, rolloff } = this._computeFrequencyFeatures();
    const timestamp = typeof performance !== "undefined" ? performance.now() : Date.now();

    const previous = this._latestFrame;
    const frame = {
      timestamp,
      rms: previous ? smoothValue(previous.rms, rmsResult.rms, this.featureSmoothing) : rmsResult.rms,
      peak: rmsResult.peak,
      bands: bands.map((value, index) => {
        const previousValue = previous?.bands?.[index];
        return previous ? smoothValue(previousValue, value, this.featureSmoothing) : value;
      }),
      bandLabels: this.bandDefinitions.map((band) => band.label),
      centroid: previous ? smoothValue(previous.centroid, centroid, this.featureSmoothing) : centroid,
      rolloff: previous ? smoothValue(previous.rolloff, rolloff, this.featureSmoothing) : rolloff,
      energy: previous ? smoothValue(previous.energy, averageEnergy, this.featureSmoothing) : averageEnergy
    };

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
      return {
        bands: new Array(this.bandDefinitions.length).fill(0),
        averageEnergy: 0,
        centroid: 0,
        rolloff: 0
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

    return {
      bands: bandValues,
      averageEnergy,
      centroid,
      rolloff: rolloffFrequency
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
}

export { DEFAULT_BAND_DEFINITIONS };
