import { ImpulseZeroCenter } from "../../physics/ImpulseZeroCenter.js";

describe("ImpulseZeroCenter", () => {
  test("centers around explicit neutral", () => {
    const zeroCenter = new ImpulseZeroCenter();
    const centeredHigh = zeroCenter.center("core", 0.8, { neutral: 0.3, deadzone: 0 });
    const centeredLow = zeroCenter.center("core", 0.2, { neutral: 0.3, deadzone: 0 });
    expect(centeredHigh).toBeCloseTo(0.5, 5);
    expect(centeredLow).toBeCloseTo(-0.1, 5);
  });

  test("tracks running baseline when neutral absent", () => {
    const zeroCenter = new ImpulseZeroCenter({ smoothing: 0.5, deadzone: 0 });
    const first = zeroCenter.center("bass", 0.2);
    const second = zeroCenter.center("bass", 0.4);
    const third = zeroCenter.center("bass", 0.2);
    expect(first).toBeCloseTo(0, 5);
    expect(second).toBeCloseTo(0.1, 5);
    expect(third).toBeLessThan(0);
  });

  test("clear removes stored baseline", () => {
    const zeroCenter = new ImpulseZeroCenter({ smoothing: 0.5, deadzone: 0 });
    zeroCenter.center("node", 0.6);
    zeroCenter.clear("node");
    const next = zeroCenter.center("node", 0.6);
    expect(next).toBeCloseTo(0, 5);
  });
});
