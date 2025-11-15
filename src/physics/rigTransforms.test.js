import { applyPositionOffset, sanitizeVector3 } from "./rigTransforms.js";

describe("sanitizeVector3", () => {
  it("returns fallback for invalid input", () => {
    expect(sanitizeVector3(null)).toEqual([0, 0, 0]);
  });

  it("normalizes array values", () => {
    expect(sanitizeVector3([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("clamps non-finite entries to fallback", () => {
    expect(sanitizeVector3([1, Number.NaN, Infinity], [4, 5, 6])).toEqual([1, 5, 6]);
  });

  it("supports vector-like objects", () => {
    expect(sanitizeVector3({ x: -2, y: 0.5, z: 3.1 })).toEqual([-2, 0.5, 3.1]);
  });
});

describe("applyPositionOffset", () => {
  it("adds offsets after sanitization", () => {
    expect(applyPositionOffset([1, 2, 3], [0.5, -0.5, 1])).toEqual([1.5, 1.5, 4]);
  });

  it("handles missing local and offset inputs", () => {
    expect(applyPositionOffset(undefined, undefined)).toEqual([0, 0, 0]);
  });
});
