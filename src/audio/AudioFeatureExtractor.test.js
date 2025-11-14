import { AudioFeatureExtractor, DEFAULT_BAND_DEFINITIONS } from "./AudioFeatureExtractor.js";

class MockAnalyser {
  constructor({ fftSize, timeData, frequencyData }) {
    this.fftSize = fftSize;
    this.frequencyBinCount = fftSize / 2;
    this.timeData = Uint8Array.from(timeData);
    this.frequencyData = Uint8Array.from(frequencyData);
  }

  getByteTimeDomainData(target) {
    target.set(this.timeData);
  }

  getByteFrequencyData(target) {
    target.set(this.frequencyData);
  }

  connect() {}

  setTimeData(values) {
    this.timeData = Uint8Array.from(values);
  }

  setFrequencyData(values) {
    this.frequencyData = Uint8Array.from(values);
  }
}

describe("AudioFeatureExtractor", () => {
  const fftSize = 8;
  const sampleRate = 48000;
  const freqResolution = sampleRate / fftSize;
  const nyquist = sampleRate / 2;

  function createContext(analyser) {
    return {
      sampleRate,
      createAnalyser: () => analyser
    };
  }

  function computeRmsFromBytes(bytes) {
    const samples = bytes.length;
    let sumSquares = 0;
    for (let i = 0; i < samples; i += 1) {
      const normalized = (bytes[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / samples);
  }

  test("computes RMS, bands, centroid, and rolloff", () => {
    const timeSamples = [128, 255, 0, 128, 128, 128, 128, 128];
    const frequencySamples = [0, 64, 128, 255];
    const analyser = new MockAnalyser({ fftSize, timeData: timeSamples, frequencyData: frequencySamples });
    const context = createContext(analyser);

    const bandDefinitions = [
      { label: "low", min: 0, max: 10000 },
      { label: "high", min: 10000, max: 24000 }
    ];

    const extractor = new AudioFeatureExtractor({
      audioContext: context,
      analyserNode: analyser,
      bandDefinitions
    });

    const frame = extractor.update();

    const normalizedFreq = frequencySamples.map((value) => value / 255);
    const totalEnergy = normalizedFreq.reduce((sum, value) => sum + value, 0);
    const centroidNumerator = normalizedFreq.reduce((sum, value, index) => sum + index * freqResolution * value, 0);
    const expectedCentroid = centroidNumerator / totalEnergy;
    const threshold = totalEnergy * 0.85;
    let cumulative = 0;
    let expectedRolloff = 0;
    normalizedFreq.forEach((value, index) => {
      cumulative += value;
      if (!expectedRolloff && cumulative >= threshold) {
        expectedRolloff = index * freqResolution;
      }
    });

    const expectedLow = (normalizedFreq[0] + normalizedFreq[1]) / 2;
    const expectedHigh = (normalizedFreq[2] + normalizedFreq[3]) / 2;

    expect(frame).toBeTruthy();
    expect(frame.bandLabels).toEqual(["low", "high"]);
    expect(frame.bands).toHaveLength(2);
    expect(frame.bands[0]).toBeCloseTo(expectedLow, 5);
    expect(frame.bands[1]).toBeCloseTo(expectedHigh, 5);
    expect(frame.rms).toBeCloseTo(computeRmsFromBytes(Uint8Array.from(timeSamples)), 5);
    expect(frame.peak).toBeCloseTo(1, 5);
    expect(frame.centroid).toBeCloseTo(expectedCentroid / nyquist, 5);
    expect(frame.centroidHz).toBeCloseTo(expectedCentroid, 3);
    expect(frame.rolloff).toBeCloseTo(expectedRolloff / nyquist, 5);
    expect(frame.rolloffHz).toBeCloseTo(expectedRolloff, 5);
    expect(frame.nyquist).toBeCloseTo(nyquist, 5);
    expect(frame.energy).toBeCloseTo(totalEnergy / normalizedFreq.length, 5);
  });

  test("reports raw frame data without smoothing", () => {
    const silent = new Array(fftSize).fill(128);
    const loud = [0, 255, 0, 255, 0, 255, 0, 255];
    const frequencySilent = new Array(fftSize / 2).fill(0);
    const frequencyLoud = new Array(fftSize / 2).fill(255);

    const analyser = new MockAnalyser({ fftSize, timeData: silent, frequencyData: frequencySilent });
    const context = createContext(analyser);

    const extractor = new AudioFeatureExtractor({
      audioContext: context,
      analyserNode: analyser,
      bandDefinitions: DEFAULT_BAND_DEFINITIONS.slice(0, 2)
    });

    const first = extractor.update();
    analyser.setTimeData(loud);
    analyser.setFrequencyData(frequencyLoud);
    const second = extractor.update();

    const rawLoudRms = computeRmsFromBytes(Uint8Array.from(loud));

    expect(first.rms).toBeCloseTo(0, 5);
    expect(second.rms).toBeCloseTo(rawLoudRms, 5);
    expect(second.energy).toBeCloseTo(1, 5);
  });

  test("exposes fast activity gating so silence settles quickly", () => {
    const loud = [0, 255, 0, 255, 0, 255, 0, 255];
    const silent = new Array(fftSize).fill(128);
    const richFrequency = new Array(fftSize / 2).fill(255);
    const quietFrequency = new Array(fftSize / 2).fill(0);
    const analyser = new MockAnalyser({ fftSize, timeData: loud, frequencyData: richFrequency });
    const context = createContext(analyser);

    const extractor = new AudioFeatureExtractor({
      audioContext: context,
      analyserNode: analyser,
      silenceGate: {
        floorRms: 0.002,
        ceilingRms: 0.02,
        attack: 0.5,
        release: 0.05
      }
    });

    const loudFrame = extractor.update();
    expect(loudFrame.activity).toBeGreaterThan(0.4);
    expect(loudFrame.isActive).toBe(true);

    analyser.setTimeData(silent);
    analyser.setFrequencyData(quietFrequency);
    const quietFrame = extractor.update();

    expect(quietFrame.activity).toBeGreaterThanOrEqual(0);
    expect(quietFrame.activity).toBeLessThan(0.2);
    expect(quietFrame.isActive).toBe(false);
    expect(quietFrame.rms).toBe(0);
    expect(quietFrame.bands.every((value) => value === 0)).toBe(true);
  });
});
