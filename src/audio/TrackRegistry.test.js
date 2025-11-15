import { describe, expect, test } from "@jest/globals";
import { TrackRegistry } from "./TrackRegistry.js";

describe("TrackRegistry", () => {
  const buildRegistry = () =>
    new TrackRegistry([
      { id: "track01", title: "One", filename: "01.mp3" },
      { id: "track02", title: "Two", filename: "02.mp3" },
      { id: "track03", title: "Three", filename: "03.mp3" }
    ]);

  test("getNextTrack returns the next sequential entry", () => {
    const registry = buildRegistry();
    const result = registry.getNextTrack("track01");
    expect(result.id).toBe("track02");
  });

  test("getNextTrack wraps to the first track when at the end of the list", () => {
    const registry = buildRegistry();
    const result = registry.getNextTrack("track03");
    expect(result.id).toBe("track01");
  });

  test("getNextTrack falls back to the default track when id is missing", () => {
    const registry = buildRegistry();
    const result = registry.getNextTrack("unknown-track");
    expect(result.id).toBe("track01");
  });
});
