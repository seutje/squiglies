export function sanitizeVector3(value, fallback = [0, 0, 0]) {
  const [fx = 0, fy = 0, fz = 0] = Array.isArray(fallback) ? fallback : [0, 0, 0];
  if (Array.isArray(value)) {
    const [x = fx, y = fy, z = fz] = value;
    return [Number.isFinite(x) ? x : fx, Number.isFinite(y) ? y : fy, Number.isFinite(z) ? z : fz];
  }
  if (value && typeof value === "object") {
    const { x = fx, y = fy, z = fz } = value;
    return [Number.isFinite(x) ? x : fx, Number.isFinite(y) ? y : fy, Number.isFinite(z) ? z : fz];
  }
  return [fx, fy, fz];
}

export function applyPositionOffset(localTranslation, offset = [0, 0, 0]) {
  const [lx, ly, lz] = sanitizeVector3(localTranslation);
  const [ox, oy, oz] = sanitizeVector3(offset);
  return [lx + ox, ly + oy, lz + oz];
}
