export const DEFAULT_RESPAWN_THRESHOLD = -2.4;

function extractY(translation) {
  if (!translation) return undefined;
  if (typeof translation.y === "number") {
    return translation.y;
  }
  if (typeof translation[1] === "number") {
    return translation[1];
  }
  return undefined;
}

export function hasBodiesBelowThreshold(world, bodiesByName, thresholdY = DEFAULT_RESPAWN_THRESHOLD) {
  if (!world || typeof world.getRigidBody !== "function") {
    return false;
  }
  if (!bodiesByName || typeof bodiesByName.values !== "function") {
    return false;
  }
  const limit = Number.isFinite(thresholdY) ? thresholdY : DEFAULT_RESPAWN_THRESHOLD;
  if (!Number.isFinite(limit)) {
    return false;
  }
  for (const handle of bodiesByName.values()) {
    if (handle === undefined || handle === null) {
      continue;
    }
    const body = world.getRigidBody(handle);
    if (!body || typeof body.translation !== "function") {
      continue;
    }
    const translation = body.translation();
    const y = extractY(translation);
    if (Number.isFinite(y) && y < limit) {
      return true;
    }
  }
  return false;
}
