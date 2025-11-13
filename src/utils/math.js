const EPSILON = 1e-7;

export function clamp(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (min > max) {
    [min, max] = [max, min];
  }
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  const clampedT = clamp(t, 0, 1);
  return a + (b - a) * clampedT;
}

export function smoothValue(previous, target, smoothingFactor = 0.5) {
  if (!Number.isFinite(previous)) {
    return target;
  }
  const clamped = clamp(smoothingFactor, 0, 0.999999);
  return lerp(target, previous, clamped);
}

export function normalize(value, min, max) {
  if (!Number.isFinite(value) || max - min === 0) {
    return 0;
  }
  return (value - min) / (max - min);
}

export function safeDivide(numerator, denominator) {
  if (!Number.isFinite(numerator) || Math.abs(denominator) < EPSILON) {
    return 0;
  }
  return numerator / denominator;
}
