import { computeDriveValue } from "./driveMapping.js";

describe("drive mapping helper", () => {
  test("maps normalized inputs onto mapping min/max", () => {
    const mapping = { min: -1, max: 1 };
    expect(computeDriveValue(0, mapping)).toBeCloseTo(-1);
    expect(computeDriveValue(1, mapping)).toBeCloseTo(1);
    expect(computeDriveValue(0.5, mapping)).toBeCloseTo(0);
  });

  test("clamps values outside the normalized 0-1 range", () => {
    const mapping = { min: -0.5, max: 0.5 };
    expect(computeDriveValue(-1, mapping)).toBeCloseTo(-0.5);
    expect(computeDriveValue(2, mapping)).toBeCloseTo(0.5);
  });

  test("respects degenerate ranges by returning the shared limit", () => {
    const mapping = { min: 0.75, max: 0.75 };
    expect(computeDriveValue(0, mapping)).toBeCloseTo(0.75);
    expect(computeDriveValue(1, mapping)).toBeCloseTo(0.75);
  });
});
