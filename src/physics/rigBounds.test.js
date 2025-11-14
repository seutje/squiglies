import { DEFAULT_RESPAWN_THRESHOLD, hasBodiesBelowThreshold } from "./rigBounds.js";

function createRigContext(heights = []) {
  const bodies = new Map();
  const handles = new Map();
  heights.forEach((y, index) => {
    handles.set(`body-${index}`, index);
    bodies.set(index, {
      translation: () => ({ x: 0, y, z: 0 })
    });
  });
  const world = {
    getRigidBody: (handle) => bodies.get(handle)
  };
  return { world, handles };
}

describe("rig bounds helpers", () => {
  test("returns false when all bodies are above the threshold", () => {
    const { world, handles } = createRigContext([0.5, 1.2, -1.5]);
    expect(hasBodiesBelowThreshold(world, handles, -3)).toBe(false);
  });

  test("detects when any body falls below the threshold", () => {
    const { world, handles } = createRigContext([0.4, -3.2, 1.1]);
    expect(hasBodiesBelowThreshold(world, handles, -2.5)).toBe(true);
  });

  test("falls back to default threshold when value is omitted", () => {
    const { world, handles } = createRigContext([DEFAULT_RESPAWN_THRESHOLD - 0.1]);
    expect(hasBodiesBelowThreshold(world, handles)).toBe(true);
  });

  test("guards against missing world or handles", () => {
    const { world, handles } = createRigContext([0.5]);
    expect(hasBodiesBelowThreshold(null, handles, -2)).toBe(false);
    expect(hasBodiesBelowThreshold(world, null, -2)).toBe(false);
  });
});
