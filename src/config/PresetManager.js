import { BASELINE_RIG_PRESET, RIG_DEFINITION, normalizeMappingConfig } from "./rigDefinition.js";
import { downloadTextFile } from "../utils/download.js";

const DEFAULT_PRESET_BASE_PATH = "./presets";
const DEFAULT_PHYSICS = {
  gravity: [0, -9.81, 0],
  damping: 0.6,
  stiffness: 1
};
const DEFAULT_RENDERING = {
  backgroundColor: "#050505",
  colorPalette: ["#0ea5e9", "#a855f7", "#f97316"],
  bloom: false
};
const DEFAULT_COLOR_PALETTES = [
  ["#0ea5e9", "#a855f7", "#f97316"],
  ["#14b8a6", "#f59e0b", "#f43f5e"],
  ["#fb7185", "#fcd34d", "#38bdf8"],
  ["#22d3ee", "#e879f9", "#c084fc"]
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEvent(type, detail) {
  if (typeof CustomEvent === "function") {
    return new CustomEvent(type, { detail });
  }
  if (typeof Event === "function") {
    const event = new Event(type);
    event.detail = detail;
    return event;
  }
  return null;
}

export class PresetManager extends EventTarget {
  constructor({
    rigDefinition = RIG_DEFINITION,
    presetBasePath = DEFAULT_PRESET_BASE_PATH,
    featureBandCount = 6,
    fetchImpl = null
  } = {}) {
    super();
    this.rigDefinition = rigDefinition;
    this.presetBasePath = presetBasePath;
    this.featureBandCount = Math.max(1, featureBandCount);
    this.fetchImpl = fetchImpl ?? (typeof fetch === "function" ? fetch.bind(globalThis) : null);

    this.presets = new Map();
    this.trackPresetIds = new Map();
    this.currentPresetId = null;
    this.activeTrackId = null;
    this.randomCounter = 0;

    const baseline = this._cloneAndNormalizePreset(BASELINE_RIG_PRESET);
    this.registerPreset(baseline, { makeActive: true });
  }

  getCurrentPreset() {
    if (!this.currentPresetId) return null;
    return this.presets.get(this.currentPresetId) ?? null;
  }

  getPresetById(presetId) {
    return this.presets.get(presetId) ?? null;
  }

  listPresetSummaries({ trackId = null } = {}) {
    const presets = Array.from(this.presets.values());
    return presets
      .filter((preset) => {
        if (trackId === null || trackId === undefined) {
          return true;
        }
        return (preset.trackId ?? null) === trackId;
      })
      .map((preset) => ({
        id: preset.id,
        name: preset.name,
        trackId: preset.trackId ?? null,
        description: preset.description ?? ""
      }));
  }

  getActiveTrackId() {
    return this.activeTrackId;
  }

  getPresetForTrack(trackId) {
    if (!trackId) {
      return this.getCurrentPreset() ?? this._buildFallbackPreset(null);
    }
    const presetId = this.trackPresetIds.get(trackId);
    if (presetId && this.presets.has(presetId)) {
      return this.presets.get(presetId);
    }
    const fallback = this._registerFallbackPreset(trackId);
    return fallback;
  }

  setCurrentPreset(presetId) {
    if (!presetId || !this.presets.has(presetId)) {
      console.warn(`PresetManager: Unknown preset "${presetId}"`);
      return null;
    }
    this.currentPresetId = presetId;
    const preset = this.presets.get(presetId);
    if (preset?.trackId) {
      this.trackPresetIds.set(preset.trackId, presetId);
      this.activeTrackId = preset.trackId;
    }
    this._emit("presetchange", { preset });
    return preset;
  }

  setActiveTrack(trackId) {
    this.activeTrackId = trackId ?? null;
    const preset = this.getPresetForTrack(trackId);
    if (preset) {
      this.currentPresetId = preset.id;
      this._emit("presetchange", { preset });
    }
    return preset;
  }

  registerPreset(rawPreset, { trackId = null, makeActive = false } = {}) {
    const preset = this._cloneAndNormalizePreset(rawPreset, trackId);
    this.presets.set(preset.id, preset);
    if (preset.trackId) {
      this.trackPresetIds.set(preset.trackId, preset.id);
    }
    if (makeActive || !this.currentPresetId) {
      this.currentPresetId = preset.id;
      this.activeTrackId = preset.trackId ?? null;
      this._emit("presetchange", { preset });
    }
    this._emit("presetregistered", { preset });
    return preset;
  }

  updateCurrentPreset(updater) {
    if (typeof updater !== "function") {
      throw new Error("updateCurrentPreset requires a function");
    }
    const current = this.getCurrentPreset();
    if (!current) {
      return null;
    }
    const workingCopy = deepClone(current);
    const updated = updater(workingCopy) ?? workingCopy;
    return this.registerPreset(updated, { trackId: updated.trackId ?? current.trackId, makeActive: true });
  }

  async loadPresetFromUrl(url, { trackId = null } = {}) {
    if (!url) {
      throw new Error("loadPresetFromUrl requires a URL");
    }
    if (!this.fetchImpl) {
      throw new Error("Fetch API is not available");
    }
    const response = await this.fetchImpl(url);
    if (!response?.ok) {
      throw new Error(`Failed to load preset from ${url}`);
    }
    const json = await response.json();
    return this.registerPreset(json, { trackId, makeActive: !this.currentPresetId });
  }

  async loadPresetsForTrackList(trackList = []) {
    const tasks = trackList.map((track) => this._loadPresetForTrack(track));
    return Promise.all(tasks);
  }

  async importPresetFromFile(file, { trackId = null, makeActive = true } = {}) {
    if (!file || typeof file.text !== "function") {
      throw new Error("importPresetFromFile expects a File or Blob");
    }
    const text = await file.text();
    return this.importPresetFromJson(text, { trackId, makeActive });
  }

  importPresetFromJson(jsonString, { trackId = null, makeActive = true } = {}) {
    if (!jsonString) {
      throw new Error("importPresetFromJson requires JSON text");
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      throw new Error("Invalid preset JSON");
    }
    return this.registerPreset(parsed, { trackId: trackId ?? parsed.trackId ?? null, makeActive });
  }

  exportPreset(presetId = null) {
    const targetId = presetId ?? this.currentPresetId;
    if (!targetId || !this.presets.has(targetId)) {
      throw new Error("exportPreset requires a valid preset");
    }
    const preset = this.presets.get(targetId);
    return JSON.stringify(preset, null, 2);
  }

  downloadPreset(presetId = null, filename = null) {
    const targetId = presetId ?? this.currentPresetId;
    if (!targetId) {
      throw new Error("downloadPreset requires a preset to export");
    }
    const preset = this.presets.get(targetId);
    if (!preset) {
      throw new Error(`Unknown preset "${targetId}"`);
    }
    const safeFilename = filename ?? `${preset.id}.json`;
    const payload = JSON.stringify(preset, null, 2);
    return downloadTextFile(safeFilename, payload);
  }

  generateRandomPreset({ trackId = null } = {}) {
    const presetId = this._generatePresetId("random");
    const colorPalette = this._randomItem(DEFAULT_COLOR_PALETTES);
    const preset = {
      id: presetId,
      name: `Random Preset ${++this.randomCounter}`,
      description: "Auto-generated mapping from Random preset generator",
      trackId: trackId ?? this.activeTrackId ?? null,
      physics: this._generateRandomPhysics(),
      rendering: {
        backgroundColor: this._randomBackgroundColor(),
        bloom: Math.random() > 0.5,
        colorPalette
      },
      mappings: this._generateRandomMappings(presetId)
    };
    return this.registerPreset(preset, { makeActive: true, trackId: preset.trackId });
  }

  _emit(type, detail) {
    const event = createEvent(type, detail);
    if (event && typeof this.dispatchEvent === "function") {
      this.dispatchEvent(event);
    }
  }

  async _loadPresetForTrack(track) {
    if (!track?.id) {
      return null;
    }
    const url = this._buildTrackPresetUrl(track);
    if (!url) {
      return this._registerFallbackPreset(track.id);
    }
    try {
      const preset = await this.loadPresetFromUrl(url, {
        trackId: track.id
      });
      if (!this.currentPresetId) {
        this.currentPresetId = preset.id;
      }
      return preset;
    } catch (error) {
      console.warn(`PresetManager: Failed to load preset for ${track.id}`, error);
      return this._registerFallbackPreset(track.id);
    }
  }

  _registerFallbackPreset(trackId) {
    const fallback = this._buildFallbackPreset(trackId);
    return this.registerPreset(fallback, {
      trackId,
      makeActive: !this.currentPresetId || this.activeTrackId === trackId
    });
  }

  _buildFallbackPreset(trackId) {
    const presetId = this._generatePresetId(trackId ? `baseline-${trackId}` : "baseline");
    const clone = this._cloneAndNormalizePreset({
      ...BASELINE_RIG_PRESET,
      id: presetId,
      name: trackId ? `Baseline – ${trackId}` : "Baseline",
      trackId
    });
    clone.mappings = clone.mappings.map((mapping, index) => ({
      ...mapping,
      id: `${presetId}-map-${index}`
    }));
    return clone;
  }

  _buildTrackPresetUrl(track) {
    if (!track) return null;
    if (typeof track === "string") {
      return `${this.presetBasePath}/${track}.json`;
    }
    if (track.presetFile) {
      return `${this.presetBasePath}/${track.presetFile}`;
    }
    if (track.filename && track.filename.endsWith(".json")) {
      return `${this.presetBasePath}/${track.filename}`;
    }
    const slug = track.id ?? track.trackId;
    if (!slug) return null;
    return `${this.presetBasePath}/${slug}.json`;
  }

  _cloneAndNormalizePreset(rawPreset, overrideTrackId = null) {
    const clone = deepClone(rawPreset ?? {});
    clone.id = clone.id ?? this._generatePresetId("preset");
    clone.name = clone.name ?? clone.id;
    clone.description = clone.description ?? "";
    clone.trackId = overrideTrackId ?? clone.trackId ?? null;
    clone.physics = this._normalizePhysics(clone.physics);
    clone.rendering = this._normalizeRendering(clone.rendering);
    clone.mappings = this._normalizeMappings(clone);
    return clone;
  }

  _normalizePhysics(physics = {}) {
    const gravity = Array.isArray(physics.gravity) && physics.gravity.length === 3 ? physics.gravity : DEFAULT_PHYSICS.gravity;
    return {
      gravity: gravity.slice(0, 3),
      damping: typeof physics.damping === "number" ? physics.damping : DEFAULT_PHYSICS.damping,
      stiffness: typeof physics.stiffness === "number" ? physics.stiffness : DEFAULT_PHYSICS.stiffness
    };
  }

  _normalizeRendering(rendering = {}) {
    const palette = Array.isArray(rendering.colorPalette) && rendering.colorPalette.length
      ? rendering.colorPalette.slice()
      : DEFAULT_RENDERING.colorPalette.slice();
    return {
      backgroundColor: typeof rendering.backgroundColor === "string" ? rendering.backgroundColor : DEFAULT_RENDERING.backgroundColor,
      bloom: typeof rendering.bloom === "boolean" ? rendering.bloom : DEFAULT_RENDERING.bloom,
      colorPalette: palette
    };
  }

  _normalizeMappings(preset) {
    if (!Array.isArray(preset.mappings) || !preset.mappings.length) {
      return BASELINE_RIG_PRESET.mappings.map((mapping, index) => ({
        ...mapping,
        id: `${preset.id}-baseline-${index}`
      }));
    }
    return preset.mappings.map((mapping, index) => {
      const normalized = normalizeMappingConfig(mapping);
      if (!normalized.id) {
        normalized.id = `${preset.id}-mapping-${index}`;
      }
      return normalized;
    });
  }

  _generateRandomPhysics() {
    const baseGravity = DEFAULT_PHYSICS.gravity;
    const jitter = () => (Math.random() - 0.5) * 4;
    return {
      gravity: [baseGravity[0] + jitter() * 0.2, baseGravity[1] + jitter(), baseGravity[2] + jitter() * 0.2],
      damping: 0.3 + Math.random() * 0.5,
      stiffness: 0.8 + Math.random() * 0.6
    };
  }

  _generateRandomMappings(presetId) {
    const bodies = this.rigDefinition?.bodies ?? [];
    const featureSpace = this._buildFeatureSpace();
    if (!bodies.length) {
      return BASELINE_RIG_PRESET.mappings.map((mapping, index) => ({
        ...mapping,
        id: `${presetId}-baseline-${index}`
      }));
    }
    return bodies.map((body, index) => {
      const feature = this._randomItem(featureSpace);
      const isTorque = Math.random() > 0.4;
      const axis = this._randomAxis(index);
      const scale = (isTorque ? 1 : 8) * (0.4 + Math.random() * 2.6);
      const smoothing = 0.25 + Math.random() * 0.5;
      const targetRange = 0.3 + Math.random() * 0.8;
      return normalizeMappingConfig({
        id: `${presetId}-${body.name ?? "body"}-${index}`,
        bodyName: body.name,
        jointName: this._guessJointForBody(body.name),
        feature,
        axis,
        mode: isTorque ? "torque" : "impulse",
        scale,
        offset: 0,
        smoothing,
        min: isTorque ? -1 : 0,
        max: 1,
        weight: 1 + Math.random() * 4,
        damping: 0.3 + Math.random() * 0.6,
        targetAngles: isTorque ? [-targetRange, targetRange] : undefined
      });
    });
  }

  _buildFeatureSpace() {
    const features = [{ type: "rms" }, { type: "peak" }, { type: "energy" }, { type: "centroid" }, { type: "rolloff" }];
    for (let i = 0; i < this.featureBandCount; i += 1) {
      features.push({ type: "band", index: i });
    }
    return features;
  }

  _randomAxis(seed = 0) {
    const rand = () => Math.random() * 2 - 1;
    let x = rand();
    let y = rand();
    let z = rand();
    let length = Math.hypot(x, y, z);
    if (!length || !Number.isFinite(length)) {
      length = seed % 3 === 0 ? 1 : 0.0001;
    }
    return [x / length, y / length, z / length];
  }

  _guessJointForBody(bodyName) {
    const joints = this.rigDefinition?.joints ?? [];
    const joint = joints.find((entry) => entry.bodyB === bodyName || entry.bodyA === bodyName);
    return joint?.name ?? null;
  }

  _randomItem(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const index = Math.floor(Math.random() * list.length);
    return deepClone(list[index]);
  }

  _randomBackgroundColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.random() * 20;
    const lightness = 10 + Math.random() * 10;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  _generatePresetId(prefix = "preset") {
    const idSegment = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}-${idSegment}`;
  }
}
