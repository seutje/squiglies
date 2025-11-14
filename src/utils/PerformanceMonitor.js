const DEFAULT_SAMPLE_SIZE = 180; // ~3 seconds at 60 fps
const DEFAULT_LOG_INTERVAL_MS = 4000;

export class PerformanceMonitor {
  constructor({
    sampleSize = DEFAULT_SAMPLE_SIZE,
    logIntervalMs = DEFAULT_LOG_INTERVAL_MS
  } = {}) {
    this.samples = new Float32Array(Math.max(30, sampleSize));
    this.samplesFilled = 0;
    this.writeIndex = 0;
    this.totalFrames = 0;
    this.logIntervalMs = Math.max(1000, logIntervalMs);
    this.lastLogTime = 0;
    this._lastMetrics = {
      fps: 0,
      frameMs: 0,
      minMs: 0,
      maxMs: 0
    };
  }

  record(deltaSeconds, timestamp = (typeof performance !== "undefined" ? performance.now() : Date.now())) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return { didLog: false, metrics: this._lastMetrics };
    }

    this.samples[this.writeIndex] = deltaSeconds;
    this.writeIndex = (this.writeIndex + 1) % this.samples.length;
    this.totalFrames += 1;
    if (this.samplesFilled < this.samples.length) {
      this.samplesFilled += 1;
    }

    const metrics = this._computeMetrics();
    this._lastMetrics = metrics;

    if (!this.lastLogTime) {
      this.lastLogTime = timestamp;
    }

    const shouldLog = timestamp - this.lastLogTime >= this.logIntervalMs;
    if (shouldLog) {
      this.lastLogTime = timestamp;
    }

    return { didLog: shouldLog, metrics };
  }

  getAverageFps() {
    return this._lastMetrics.fps;
  }

  _computeMetrics() {
    const hasSamples = Math.min(this.totalFrames, this.samples.length, this.samplesFilled) > 0;
    if (!hasSamples) {
      return { fps: 0, frameMs: 0, minMs: 0, maxMs: 0 };
    }

    const limit = this.samplesFilled < this.samples.length ? this.samplesFilled : this.samples.length;
    let total = 0;
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = 0;
    let used = 0;

    for (let i = 0; i < limit; i += 1) {
      const value = this.samples[i];
      if (!Number.isFinite(value) || value <= 0) {
        continue;
      }
      total += value;
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      used += 1;
    }

    if (!used || total === 0 || minValue === Number.POSITIVE_INFINITY) {
      return { fps: 0, frameMs: 0, minMs: 0, maxMs: 0 };
    }

    const average = total / used;
    return {
      fps: average > 0 ? 1 / average : 0,
      frameMs: average * 1000,
      minMs: minValue * 1000,
      maxMs: maxValue * 1000
    };
  }
}
