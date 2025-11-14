import { clamp, smoothValue } from "../utils/math.js";

export class ImpulseZeroCenter {
  constructor({ smoothing = 0.92, deadzone = 0.002 } = {}) {
    this._smoothing = clamp(smoothing, 0, 0.999);
    this._deadzone = Math.max(0, deadzone ?? 0);
    this._baselines = new Map();
  }

  center(key, value, { neutral, deadzone, smoothing } = {}) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const resolvedDeadzone = Number.isFinite(deadzone)
      ? Math.max(0, Math.abs(deadzone))
      : this._deadzone;
    if (Number.isFinite(neutral)) {
      const centered = value - neutral;
      return Math.abs(centered) <= resolvedDeadzone ? 0 : centered;
    }
    const resolvedSmoothing = Number.isFinite(smoothing)
      ? clamp(smoothing, 0, 0.999)
      : this._smoothing;
    const previous = this._baselines.get(key);
    const baseline = previous === undefined ? value : smoothValue(previous, value, resolvedSmoothing);
    this._baselines.set(key, baseline);
    const centered = value - baseline;
    return Math.abs(centered) <= resolvedDeadzone ? 0 : centered;
  }

  clear(key = null) {
    if (key === null) {
      this._baselines.clear();
      return;
    }
    this._baselines.delete(key);
  }
}
