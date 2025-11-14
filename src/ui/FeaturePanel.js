import GUI from "lil-gui";
import { DEFAULT_BAND_DEFINITIONS } from "../audio/AudioFeatureExtractor.js";

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

export class FeaturePanel {
  constructor({ container, featureSource = null } = {}) {
    this.container = container ?? document.body;
    this.featureSource = featureSource;
    this.gui = null;
    this.guiRootElement = null;
    this.summaryControllers = {};
    this.bandControllers = [];
    this.bandFolder = null;
    this.bandLabels = DEFAULT_BAND_DEFINITIONS.map((band) => band.label);
    this.bandState = {};
    this.guiState = {
      rms: 0,
      peak: 0,
      energy: 0,
      activity: 0,
      centroid: 0,
      rolloff: 0
    };
    this.unsubscribe = null;
  }

  init() {
    this._createPanelRoot();
    this._buildGui();
    if (this.featureSource) {
      this.attachFeatureSource(this.featureSource);
    }
  }

  attachFeatureSource(source) {
    if (typeof this.unsubscribe === "function") {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (!source?.onAudioFeatureFrame) return;
    this.featureSource = source;
    try {
      this.unsubscribe = source.onAudioFeatureFrame((frame) => {
        this._handleFrame(frame);
      });
      const latest = source.getLatestAudioFeatureFrame?.();
      if (latest) {
        this._handleFrame(latest);
      }
    } catch (error) {
      console.warn("FeaturePanel: unable to subscribe to feature source", error);
    }
  }

  setBandLabels(labels = []) {
    if (!Array.isArray(labels) || !labels.length) return;
    this.bandLabels = labels;
    this._syncBandControllers();
  }

  _createPanelRoot() {
    if (this.guiRootElement) return;
    const host = this.container ?? document.body;
    const element = document.createElement("div");
    element.className = "visualizer-feature-panel";
    host.appendChild(element);
    this.guiRootElement = element;
  }

  _buildGui() {
    if (!this.guiRootElement) {
      this._createPanelRoot();
    }
    this.gui = new GUI({
      container: this.guiRootElement,
      width: 260,
      title: "Audio Features"
    });
    this.gui.title("Audio Features");

    const summaryFolder = this.gui.addFolder("Summary");
    this.summaryControllers.rms = summaryFolder
      .add(this.guiState, "rms", 0, 1, 0.001)
      .name("RMS")
      .listen();
    this.summaryControllers.peak = summaryFolder
      .add(this.guiState, "peak", 0, 1, 0.001)
      .name("Peak")
      .listen();
    this.summaryControllers.energy = summaryFolder
      .add(this.guiState, "energy", 0, 1, 0.001)
      .name("Energy")
      .listen();
    this.summaryControllers.activity = summaryFolder
      .add(this.guiState, "activity", 0, 1, 0.001)
      .name("Activity")
      .listen();
    this.summaryControllers.centroid = summaryFolder
      .add(this.guiState, "centroid")
      .name("Centroid (Hz)")
      .listen();
    this.summaryControllers.rolloff = summaryFolder
      .add(this.guiState, "rolloff")
      .name("Rolloff (Hz)")
      .listen();
    Object.values(this.summaryControllers).forEach((controller) => controller.disable?.());
    summaryFolder.open();

    this.bandFolder = this.gui.addFolder("Frequency bands");
    this._buildBandControllers();
    this.bandFolder.open();
  }

  _buildBandControllers() {
    this.bandControllers.forEach((entry) => {
      this.bandFolder.remove(entry.controller);
    });
    this.bandControllers = [];
    this.bandState = {};
    this.bandLabels.forEach((label, index) => {
      const key = `band${index}`;
      this.bandState[key] = 0;
      const controller = this.bandFolder
        .add(this.bandState, key, 0, 1, 0.001)
        .name(label)
        .listen();
      controller.disable?.();
      this.bandControllers.push({ key, controller });
    });
  }

  _syncBandControllers() {
    if (!this.bandFolder) return;
    if (this.bandLabels.length !== this.bandControllers.length) {
      this._buildBandControllers();
      return;
    }
    this.bandLabels.forEach((label, index) => {
      const entry = this.bandControllers[index];
      entry.controller.name(label);
    });
  }

  _handleFrame(frame) {
    const bands = Array.isArray(frame?.bands) ? frame.bands : [];
    const labels = Array.isArray(frame?.bandLabels) ? frame.bandLabels : this.bandLabels;
    if (labels.length && labels.length !== this.bandLabels.length) {
      this.bandLabels = labels;
      this._syncBandControllers();
    }
    this._updateSummaryValues(frame);
    this._updateBandValues(bands);
  }

  _updateSummaryValues(frame) {
    const rms = clamp01(frame?.rms ?? 0);
    const peak = clamp01(frame?.peak ?? 0);
    const energy = clamp01(frame?.energy ?? 0);
    const activity = clamp01(frame?.activity ?? 0);
    const centroidHz = Math.max(0, Number(frame?.centroidHz ?? frame?.centroid) || 0);
    const rolloffHz = Math.max(0, Number(frame?.rolloffHz ?? frame?.rolloff) || 0);

    this.guiState.rms = Number(rms.toFixed(3));
    this.guiState.peak = Number(peak.toFixed(3));
    this.guiState.energy = Number(energy.toFixed(3));
    this.guiState.activity = Number(activity.toFixed(3));
    this.guiState.centroid = Math.round(centroidHz);
    this.guiState.rolloff = Math.round(rolloffHz);
    Object.values(this.summaryControllers).forEach((controller) => controller.updateDisplay?.());
  }

  _updateBandValues(bands) {
    if (!bands.length) {
      this.bandControllers.forEach((entry) => {
        this.bandState[entry.key] = 0;
        entry.controller.updateDisplay?.();
      });
      return;
    }
    this.bandControllers.forEach((entry, index) => {
      const value = clamp01(bands[index] ?? 0);
      this.bandState[entry.key] = Number(value.toFixed(3));
      entry.controller.updateDisplay?.();
    });
  }
}
