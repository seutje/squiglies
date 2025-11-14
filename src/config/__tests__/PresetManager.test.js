import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { PresetManager } from "../PresetManager.js";

const TEST_RIG = {
  bodies: [
    { name: "core" },
    { name: "spine" },
    { name: "armLeft" }
  ],
  joints: [
    { name: "core_spine", bodyA: "core", bodyB: "spine" },
    { name: "spine_armLeft", bodyA: "spine", bodyB: "armLeft" }
  ]
};

describe("PresetManager", () => {
  let manager;

  beforeEach(() => {
    manager = new PresetManager({
      rigDefinition: TEST_RIG,
      fetchImpl: jest.fn(async () => ({
        ok: false,
        async json() {
          return {};
        }
      }))
    });
  });

  test("generateRandomPreset produces mappings for each body", () => {
    const preset = manager.generateRandomPreset({ trackId: "track01" });
    expect(preset.trackId).toBe("track01");
    expect(preset.mappings).toHaveLength(TEST_RIG.bodies.length);
    expect(manager.getCurrentPreset().id).toBe(preset.id);
  });

  test("importPresetFromJson registers and activates preset", () => {
    const json = JSON.stringify({
      id: "custom-preset",
      name: "Custom",
      trackId: "track42",
      mappings: [
        { bodyName: "core", feature: { type: "rms" }, mode: "torque", axis: [0, 1, 0], scale: 1 }
      ]
    });
    const preset = manager.importPresetFromJson(json);
    expect(preset.id).toBe("custom-preset");
    expect(manager.getPresetById("custom-preset")).toBeTruthy();
    expect(manager.getCurrentPreset().id).toBe("custom-preset");
  });

  test("setActiveTrack falls back to baseline when preset missing", () => {
    const preset = manager.setActiveTrack("missing-track");
    expect(preset.trackId).toBe("missing-track");
    expect(manager.getCurrentPreset().trackId).toBe("missing-track");
  });

  test("loadPresetsForTrackList fetches preset JSON and registers it", async () => {
    const payload = {
      id: "track01-default",
      name: "From File",
      trackId: "track01",
      mappings: [
        { bodyName: "core", feature: { type: "rms" }, mode: "torque", axis: [0, 1, 0], scale: 1 }
      ]
    };

    const fetchImpl = jest.fn(async () => ({
      ok: true,
      async json() {
        return payload;
      }
    }));

    const loader = new PresetManager({ rigDefinition: TEST_RIG, fetchImpl });
    await loader.loadPresetsForTrackList([{ id: "track01" }]);

    const preset = loader.getPresetForTrack("track01");
    expect(preset.id).toBe(payload.id);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("exportPreset returns JSON string", () => {
    const preset = manager.setActiveTrack("export-track");
    const exported = manager.exportPreset(preset.id);
    expect(typeof exported).toBe("string");
    expect(exported).toContain(preset.id);
  });

  test("updateCurrentPreset applies updater and preserves track binding", () => {
    const baseline = manager.setActiveTrack("track-test");
    expect(baseline.trackId).toBe("track-test");

    const updated = manager.updateCurrentPreset((draft) => {
      draft.physics.damping = 0.42;
      draft.rendering.backgroundColor = "#123456";
    });

    expect(updated.physics.damping).toBeCloseTo(0.42);
    expect(manager.getCurrentPreset().trackId).toBe("track-test");
    expect(manager.getCurrentPreset().rendering.backgroundColor).toBe("#123456");
  });

  test("generateRandomPreset produces themed rendering data", () => {
    const preset = manager.generateRandomPreset();
    expect(Array.isArray(preset.rendering.colorPalette)).toBe(true);
    expect(preset.rendering.colorPalette.length).toBeGreaterThanOrEqual(3);
    expect(typeof preset.rendering.backgroundColor).toBe("string");
  });
});
