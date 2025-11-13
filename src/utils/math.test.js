import { clamp, lerp, smoothValue, normalize, safeDivide } from "./math.js";

describe("math helpers", () => {
  test("clamp bounds value", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-2, -1, 3)).toBe(-1);
  });

  test("lerp interpolates within range", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(5, 15, 2)).toBe(15);
  });

  test("smoothValue favors previous values when smoothing factor > 0", () => {
    const previous = 0;
    const target = 1;
    const smoothed = smoothValue(previous, target, 0.5);
    expect(smoothed).toBeCloseTo(0.5, 3);
    expect(smoothValue(undefined, target, 0.8)).toBe(target);
  });

  test("normalize maps values to 0-1 range", () => {
    expect(normalize(5, 0, 10)).toBe(0.5);
    expect(normalize(10, 10, 10)).toBe(0);
  });

  test("safeDivide guards against zero denominator", () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(10, 0)).toBe(0);
  });
});
