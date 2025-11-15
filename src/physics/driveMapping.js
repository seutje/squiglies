import { clamp } from "../utils/math.js";

export function computeDriveValue(value, mapping = {}) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const scale = Number.isFinite(mapping.scale) ? mapping.scale : 1;
  const offset = Number.isFinite(mapping.offset) ? mapping.offset : 0;
  const scaled = scale * value + offset;

  const min = Number.isFinite(mapping.min) ? mapping.min : -1;
  const max = Number.isFinite(mapping.max) ? mapping.max : 1;
  const lowerBound = Math.min(min, max);
  const upperBound = Math.max(min, max);

  if (min === max) {
    return clamp(scaled, lowerBound, upperBound);
  }

  const normalized = clamp(scaled, 0, 1);
  const mapped = min + (max - min) * normalized;

  if (!Number.isFinite(mapped)) {
    return clamp(scaled, lowerBound, upperBound);
  }

  return clamp(mapped, lowerBound, upperBound);
}
