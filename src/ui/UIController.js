import GUI from "lil-gui";
import { normalizeMappingConfig } from "../config/rigDefinition.js";

const STATUS_VARIANTS = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error"
};

const PARAM_DEFAULTS = {
  gravity: -9.81,
  damping: 0.6,
  stiffness: 1
};

const GUI_DEFAULTS = {
  backgroundColor: "#050505"
};

export class UIController {
  constructor({ rootElement, audioManager, presetManager, trackRegistry }) {
    this.rootElement = rootElement;
    this.audioManager = audioManager;
    this.presetManager = presetManager;
    this.trackRegistry = trackRegistry;

    this.elements = {};
    this.gui = null;
    this.guiControllers = {};
    this.guiRootElement = null;
    this.guiElements = {};
    this.guiState = {
      preset: "",
      gravity: PARAM_DEFAULTS.gravity,
      stiffness: PARAM_DEFAULTS.stiffness,
      damping: PARAM_DEFAULTS.damping,
      backgroundColor: GUI_DEFAULTS.backgroundColor,
      status: ""
    };
    this._mappingDefaults = {
      bodyName: "",
      jointName: "",
      mode: "torque",
      scale: 1,
      offset: 0,
      smoothing: 0.4,
      weight: 1,
      damping: 0.5,
      min: 0,
      max: 1,
      axisX: 0,
      axisY: 1,
      axisZ: 0,
      featureType: "rms",
      featureIndex: 0,
      targetMin: -0.5,
      targetMax: 0.5
    };
    this.mappingState = {
      mappingId: "",
      ...this._mappingDefaults
    };
    this.mappingControllers = {};
    this._isGuiUpdating = false;
    this._knownTrackIds = new Set();
    this._currentMappings = [];

    this._handlers = {
      onTrackSelect: (event) => this._handleTrackSelect(event),
      onFileInput: (event) => this._handleFileInput(event),
      onAudioTrackChange: (event) => this._syncTrackState(event.detail?.track),
      onAudioError: (event) =>
        this._setStatus(event.detail?.message ?? "Audio error", STATUS_VARIANTS.ERROR),
      onAudioMessage: (event) => this._handleAudioMessage(event.detail?.message ?? ""),
      onPresetChange: (event) => this._syncPresetState(event.detail?.preset),
      onPresetRegistered: () => this._populatePresetOptions(),
      onGuiRandom: () => this._handleRandomPreset(),
      onGuiExport: () => this._handleExportPreset(),
      onGuiDownload: () => this._handleDownloadPreset(),
      onGuiImportText: () => this._handleImportPresetFromText(),
      onGuiFileChange: (event) => this._handlePresetFileInput(event)
    };
  }

  init() {
    if (!this.rootElement) {
      throw new Error("UIController requires a root element");
    }
    if (!this.audioManager) {
      throw new Error("UIController requires an AudioManager instance");
    }
    if (!this.presetManager) {
      throw new Error("UIController requires a PresetManager instance");
    }

    this._render();
    this._cacheElements();
    this._bindDomEvents();
    this._bindDataSources();
    this._createGuiOverlay();
    this._buildGuiControllers();
    this._buildGuiTools();
    this._populateTrackOptions();
    this._populatePresetOptions();
    this._syncTrackState(this.audioManager.getCurrentTrack());
    this._syncPresetState(this.presetManager.getCurrentPreset());
  }

  _render() {
    this.rootElement.innerHTML = `
      <div class="track-controls">
        <label class="control-label" for="track-select">Bundled tracks</label>
        <select class="track-select" id="track-select">
          <option value="">Select a track…</option>
        </select>
        <label class="track-upload-label">
          <span>Upload audio file</span>
          <input type="file" class="track-upload-input" accept="audio/*" />
        </label>
      </div>
    `;
  }

  _cacheElements() {
    this.elements.trackSelect = this.rootElement.querySelector(".track-select");
    this.elements.fileInput = this.rootElement.querySelector(".track-upload-input");
  }

  _bindDomEvents() {
    this.elements.trackSelect?.addEventListener("change", this._handlers.onTrackSelect);
    this.elements.fileInput?.addEventListener("change", this._handlers.onFileInput);
  }

  _bindDataSources() {
    this.audioManager.addEventListener("trackchange", this._handlers.onAudioTrackChange);
    this.audioManager.addEventListener("error", this._handlers.onAudioError);
    this.audioManager.addEventListener("message", this._handlers.onAudioMessage);
    this.presetManager.addEventListener("presetchange", this._handlers.onPresetChange);
    this.presetManager.addEventListener("presetregistered", this._handlers.onPresetRegistered);
  }

  _populateTrackOptions() {
    if (!this.trackRegistry || !this.elements.trackSelect) return;
    const tracks = this.trackRegistry.listTracks();
    const fragment = document.createDocumentFragment();
    tracks.forEach((track) => {
      this._knownTrackIds.add(track.id);
      fragment.appendChild(this._buildTrackOption(track));
    });
    this.elements.trackSelect.appendChild(fragment);
  }

  _populatePresetOptions() {
    const controller = this.guiControllers.preset;
    if (!controller) return;
    const summaries = this.presetManager?.listPresetSummaries?.() ?? [];
    const options = {};
    summaries.forEach((preset) => {
      const trackSuffix = preset.trackId ? ` – ${preset.trackId}` : "";
      options[`${preset.name}${trackSuffix}`] = preset.id;
    });
    controller.options(options);
    const activeId = this.presetManager?.getCurrentPreset()?.id ?? "";
    if (activeId) {
      this._setGuiValue("preset", activeId);
    }
  }

  _handleTrackSelect(event) {
    const trackId = event.target.value;
    if (!trackId) return;
    this.audioManager
      .loadTrack(trackId)
      .then(() => {
        const label = event.target.selectedOptions?.[0]?.textContent ?? "track";
        this._setStatus(`Loaded ${label}`, STATUS_VARIANTS.SUCCESS);
      })
      .catch(() => {
        this._setStatus("Failed to load track", STATUS_VARIANTS.ERROR);
      });
  }

  _handleFileInput(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    this.audioManager
      .loadUserFile(file)
      .then((track) => {
        if (this.elements.fileInput) {
          this.elements.fileInput.value = "";
        }
        this._ensureTrackOption(track);
        this._setStatus(`Loaded ${track.title}`, STATUS_VARIANTS.SUCCESS);
      })
      .catch(() => {
        this._setStatus("Unable to read audio file", STATUS_VARIANTS.ERROR);
      });
  }

  _handleAudioMessage(message) {
    if (!message) return;
    this._setStatus(message, STATUS_VARIANTS.INFO);
  }

  _handleGuiPresetSelect(presetId) {
    if (!presetId || this._isGuiUpdating) return;
    const preset = this.presetManager.setCurrentPreset(presetId);
    if (preset) {
      this._setStatus(`Activated ${preset.name}`, STATUS_VARIANTS.INFO);
    }
  }

  _handleGuiParameterChange(key, value) {
    if (this._isGuiUpdating) return;
    this._applyParameterChange(key, value);
  }

  _handleGuiBackgroundChange(value) {
    if (this._isGuiUpdating || !value) return;
    this._updatePreset((preset) => {
      preset.rendering = preset.rendering ?? {};
      preset.rendering.backgroundColor = value;
      return preset;
    });
  }

  _createGuiOverlay() {
    if (this.gui) return;
    const host = document.getElementById("visualizer-container") ?? document.body;
    let container = host.querySelector(".visualizer-gui-overlay");
    if (!container) {
      container = document.createElement("div");
      container.className = "visualizer-gui-overlay";
      host.appendChild(container);
    }
    this.guiRootElement = container;
    this.gui = new GUI({
      container,
      width: 320,
      title: "Rig Controls"
    });
    this.gui.title("Rig Controls");
  }

  _buildGuiControllers() {
    if (!this.gui) return;
    const presetFolder = this.gui.addFolder("Presets");
    this.guiControllers.preset = presetFolder
      .add(this.guiState, "preset", {})
      .name("Active preset")
      .onChange((value) => this._handleGuiPresetSelect(value));
    this.guiControllers.status = presetFolder
      .add(this.guiState, "status")
      .name("Status")
      .listen();
    this.guiControllers.status.disable?.();
    presetFolder.open();

    const physicsFolder = this.gui.addFolder("Physics");
    this.guiControllers.gravity = physicsFolder
      .add(this.guiState, "gravity", -30, -2, 0.1)
      .name("Gravity (Y)")
      .onChange((value) => this._handleGuiParameterChange("gravity", value));
    this.guiControllers.stiffness = physicsFolder
      .add(this.guiState, "stiffness", 0.25, 2, 0.05)
      .name("Rig drive")
      .onChange((value) => this._handleGuiParameterChange("stiffness", value));
    this.guiControllers.damping = physicsFolder
      .add(this.guiState, "damping", 0.2, 1.5, 0.05)
      .name("Rig damping")
      .onChange((value) => this._handleGuiParameterChange("damping", value));
    physicsFolder.open();

    const sceneFolder = this.gui.addFolder("Scene");
    this.guiControllers.background = sceneFolder
      .addColor(this.guiState, "backgroundColor")
      .name("Background")
      .onChange((value) => this._handleGuiBackgroundChange(value));
    sceneFolder.open();

    this._buildMappingGui();
  }

  _buildGuiTools() {
    if (!this.guiRootElement || this.guiElements.toolsRoot) return;
    const container = document.createElement("div");
    container.className = "gui-tools";
    container.innerHTML = `
      <div class="gui-tools-row">
        <button type="button" data-role="random">Randomize</button>
        <button type="button" data-role="export">Show JSON</button>
        <button type="button" data-role="download">Download JSON</button>
      </div>
      <textarea class="gui-tools-textarea" rows="6" placeholder="Preset JSON will appear here when exported."></textarea>
      <div class="gui-tools-row">
        <button type="button" data-role="import-text">Import from text</button>
        <button type="button" data-role="import-file">Import from file</button>
        <input type="file" class="gui-tools-file" accept="application/json" />
      </div>
      <div class="gui-tools-status" aria-live="polite"></div>
    `;
    this.guiRootElement.appendChild(container);
    this.guiElements.toolsRoot = container;
    this.guiElements.textarea = container.querySelector(".gui-tools-textarea");
    this.guiElements.message = container.querySelector(".gui-tools-status");
    this.guiElements.fileInput = container.querySelector(".gui-tools-file");

    container.querySelector('[data-role="random"]')?.addEventListener("click", this._handlers.onGuiRandom);
    container.querySelector('[data-role="export"]')?.addEventListener("click", this._handlers.onGuiExport);
    container.querySelector('[data-role="download"]')?.addEventListener("click", this._handlers.onGuiDownload);
    container.querySelector('[data-role="import-text"]')?.addEventListener("click", this._handlers.onGuiImportText);
    container.querySelector('[data-role="import-file"]')?.addEventListener("click", () => {
      this.guiElements.fileInput?.click();
    });
    this.guiElements.fileInput?.addEventListener("change", this._handlers.onGuiFileChange);
  }

  _buildMappingGui() {
    if (!this.gui) return;
    const mappingFolder = this.gui.addFolder("Mappings");
    this.mappingControllers.mappingId = mappingFolder
      .add(this.mappingState, "mappingId", {})
      .name("Active mapping")
      .onChange((value) => this._handleMappingSelect(value));

    this.mappingControllers.bodyName = mappingFolder
      .add(this.mappingState, "bodyName")
      .name("Body")
      .listen();
    this.mappingControllers.bodyName.disable?.();

    this.mappingControllers.jointName = mappingFolder
      .add(this.mappingState, "jointName")
      .name("Joint")
      .listen();
    this.mappingControllers.jointName.disable?.();

    this.mappingControllers.mode = mappingFolder
      .add(this.mappingState, "mode", { Torque: "torque", Impulse: "impulse" })
      .name("Drive mode")
      .onChange((value) => this._handleMappingModeChange(value));

    const featureFolder = mappingFolder.addFolder("Feature");
    this.mappingControllers.featureType = featureFolder
      .add(this.mappingState, "featureType", {
        RMS: "rms",
        Peak: "peak",
        Band: "band",
        Energy: "energy",
        Centroid: "centroid",
        Rolloff: "rolloff"
      })
      .name("Type")
      .onChange((value) => this._handleFeatureTypeChange(value));

    const maxIndex = Math.max(0, (this.presetManager?.featureBandCount ?? 6) - 1);
    this.mappingControllers.featureIndex = featureFolder
      .add(this.mappingState, "featureIndex", 0, Math.max(0, maxIndex), 1)
      .name("Band index")
      .onChange((value) => this._handleFeatureIndexChange(value));

    const driveFolder = mappingFolder.addFolder("Drive");
    this.mappingControllers.scale = driveFolder
      .add(this.mappingState, "scale", -8, 8, 0.05)
      .name("Scale")
      .onChange((value) => this._handleMappingNumberChange("scale", value));
    this.mappingControllers.offset = driveFolder
      .add(this.mappingState, "offset", -5, 5, 0.05)
      .name("Offset")
      .onChange((value) => this._handleMappingNumberChange("offset", value));
    this.mappingControllers.smoothing = driveFolder
      .add(this.mappingState, "smoothing", 0, 0.95, 0.01)
      .name("Smoothing")
      .onChange((value) => this._handleMappingNumberChange("smoothing", value));
    this.mappingControllers.weight = driveFolder
      .add(this.mappingState, "weight", 0, 10, 0.1)
      .name("Weight")
      .onChange((value) => this._handleMappingNumberChange("weight", value));
    this.mappingControllers.damping = driveFolder
      .add(this.mappingState, "damping", 0, 2, 0.05)
      .name("Damping")
      .onChange((value) => this._handleMappingNumberChange("damping", value));
    this.mappingControllers.min = driveFolder
      .add(this.mappingState, "min", -5, 5, 0.05)
      .name("Clamp min")
      .onChange((value) => this._handleMappingNumberChange("min", value));
    this.mappingControllers.max = driveFolder
      .add(this.mappingState, "max", -5, 5, 0.05)
      .name("Clamp max")
      .onChange((value) => this._handleMappingNumberChange("max", value));
    this.mappingControllers.targetMin = driveFolder
      .add(this.mappingState, "targetMin", -Math.PI, Math.PI, 0.05)
      .name("Target min")
      .onChange((value) => this._handleTargetAngleChange("min", value));
    this.mappingControllers.targetMax = driveFolder
      .add(this.mappingState, "targetMax", -Math.PI, Math.PI, 0.05)
      .name("Target max")
      .onChange((value) => this._handleTargetAngleChange("max", value));

    const axisFolder = mappingFolder.addFolder("Axis");
    this.mappingControllers.axisX = axisFolder
      .add(this.mappingState, "axisX", -1, 1, 0.05)
      .name("X")
      .onChange((value) => this._handleAxisChange(0, value));
    this.mappingControllers.axisY = axisFolder
      .add(this.mappingState, "axisY", -1, 1, 0.05)
      .name("Y")
      .onChange((value) => this._handleAxisChange(1, value));
    this.mappingControllers.axisZ = axisFolder
      .add(this.mappingState, "axisZ", -1, 1, 0.05)
      .name("Z")
      .onChange((value) => this._handleAxisChange(2, value));

    mappingFolder.open();
    featureFolder.open();
    driveFolder.open();
    axisFolder.close();
    this._updateFeatureIndexVisibility();
  }

  _refreshMappingGui(preset) {
    if (!this.mappingControllers.mappingId) return;
    const mappings = Array.isArray(preset?.mappings) ? preset.mappings : [];
    this._currentMappings = mappings.map((mapping, index) => ({
      id: this._resolveMappingId(mapping, index),
      index,
      raw: mapping,
      normalized: normalizeMappingConfig(mapping)
    }));
    const options = {};
    this._currentMappings.forEach((entry, index) => {
      options[this._formatMappingLabel(entry.normalized, index)] = entry.id;
    });
    this.mappingControllers.mappingId.options(options);
    if (!this._currentMappings.length) {
      this._setMappingGuiValue("mappingId", "");
      this._clearMappingFields();
      return;
    }
    const currentId = this.mappingState.mappingId;
    const hasCurrent = this._currentMappings.some((entry) => entry.id === currentId);
    const nextId = hasCurrent ? currentId : this._currentMappings[0].id;
    this._setMappingGuiValue("mappingId", nextId);
    this._syncMappingFields(nextId);
  }

  _handleMappingSelect(mappingId) {
    if (this._isGuiUpdating) return;
    this._syncMappingFields(mappingId);
  }

  _syncMappingFields(mappingId) {
    const entry = this._currentMappings.find((item) => item.id === mappingId);
    if (!entry) {
      this._clearMappingFields();
      return;
    }
    const mapping = entry.normalized ?? normalizeMappingConfig(entry.raw);
    this._setMappingGuiValue("bodyName", mapping.bodyName ?? "");
    this._setMappingGuiValue("jointName", mapping.jointName ?? "");
    this._setMappingGuiValue("mode", mapping.mode ?? this._mappingDefaults.mode);
    this._setMappingGuiValue("scale", mapping.scale ?? this._mappingDefaults.scale);
    this._setMappingGuiValue("offset", mapping.offset ?? this._mappingDefaults.offset);
    this._setMappingGuiValue("smoothing", mapping.smoothing ?? this._mappingDefaults.smoothing);
    this._setMappingGuiValue("weight", mapping.weight ?? this._mappingDefaults.weight);
    this._setMappingGuiValue("damping", mapping.damping ?? this._mappingDefaults.damping);
    this._setMappingGuiValue("min", mapping.min ?? this._mappingDefaults.min);
    this._setMappingGuiValue("max", mapping.max ?? this._mappingDefaults.max);
    const axis = Array.isArray(mapping.axis) ? mapping.axis : [0, 1, 0];
    this._setMappingGuiValue("axisX", axis[0] ?? this._mappingDefaults.axisX);
    this._setMappingGuiValue("axisY", axis[1] ?? this._mappingDefaults.axisY);
    this._setMappingGuiValue("axisZ", axis[2] ?? this._mappingDefaults.axisZ);
    const featureType = mapping.feature?.type ?? this._mappingDefaults.featureType;
    this._setMappingGuiValue("featureType", featureType);
    const featureIndex = Number.isFinite(mapping.feature?.index) ? mapping.feature.index : this._mappingDefaults.featureIndex;
    this._setMappingGuiValue("featureIndex", featureIndex);
    const targetAngles = Array.isArray(mapping.targetAngles) ? mapping.targetAngles : null;
    this._setMappingGuiValue(
      "targetMin",
      targetAngles ? targetAngles[0] ?? this._mappingDefaults.targetMin : this._mappingDefaults.targetMin
    );
    this._setMappingGuiValue(
      "targetMax",
      targetAngles ? targetAngles[1] ?? this._mappingDefaults.targetMax : this._mappingDefaults.targetMax
    );
  }

  _clearMappingFields() {
    Object.entries(this._mappingDefaults).forEach(([key, value]) => {
      if (key in this.mappingState) {
        this._setMappingGuiValue(key, value);
      }
    });
  }

  _handleMappingNumberChange(field, value) {
    if (this._isGuiUpdating || !Number.isFinite(value)) return;
    const mappingId = this.mappingState.mappingId;
    if (!mappingId) return;
    this._applyMappingUpdate(mappingId, (mapping) => {
      mapping[field] = value;
    });
  }

  _handleAxisChange(axisIndex, value) {
    if (this._isGuiUpdating || !Number.isFinite(value)) return;
    const mappingId = this.mappingState.mappingId;
    if (!mappingId) return;
    this._applyMappingUpdate(mappingId, (mapping) => {
      const axis = Array.isArray(mapping.axis) ? mapping.axis.slice() : [0, 1, 0];
      axis[axisIndex] = value;
      mapping.axis = axis;
    });
  }

  _handleMappingModeChange(value) {
    if (this._isGuiUpdating || !value) return;
    const mappingId = this.mappingState.mappingId;
    if (!mappingId) return;
    this._applyMappingUpdate(mappingId, (mapping) => {
      mapping.mode = value;
    });
  }

  _handleFeatureTypeChange(type) {
    if (this._isGuiUpdating || !type) return;
    const mappingId = this.mappingState.mappingId;
    if (!mappingId) return;
    const featureIndex = Number.isFinite(this.mappingState.featureIndex) ? this.mappingState.featureIndex : 0;
    this._applyMappingUpdate(mappingId, (mapping) => {
      const feature = { type };
      if (type === "band" || type === "energy") {
        feature.index = Math.max(0, Math.round(featureIndex));
      }
      mapping.feature = feature;
    });
  }

  _handleFeatureIndexChange(index) {
    if (this._isGuiUpdating || !Number.isFinite(index)) return;
    const mappingId = this.mappingState.mappingId;
    if (!mappingId) return;
    if (this.mappingState.featureType !== "band" && this.mappingState.featureType !== "energy") {
      return;
    }
    const clampedIndex = Math.max(0, Math.round(index));
    this._applyMappingUpdate(mappingId, (mapping) => {
      mapping.feature = mapping.feature ?? { type: this.mappingState.featureType };
      mapping.feature.type = this.mappingState.featureType;
      mapping.feature.index = clampedIndex;
    });
  }

  _handleTargetAngleChange(which, value) {
    if (this._isGuiUpdating || !Number.isFinite(value)) return;
    const mappingId = this.mappingState.mappingId;
    if (!mappingId) return;
    this._applyMappingUpdate(mappingId, (mapping) => {
      const targetAngles = Array.isArray(mapping.targetAngles)
        ? mapping.targetAngles.slice(0, 2)
        : [this._mappingDefaults.targetMin, this._mappingDefaults.targetMax];
      if (which === "min") {
        targetAngles[0] = value;
      } else {
        targetAngles[1] = value;
      }
      mapping.targetAngles = targetAngles;
    });
  }

  _applyMappingUpdate(mappingId, mutator) {
    if (!mappingId || typeof mutator !== "function") return;
    this._updatePreset((preset) => {
      if (!Array.isArray(preset.mappings)) {
        return preset;
      }
      const index = preset.mappings.findIndex((mapping, idx) => this._resolveMappingId(mapping, idx) === mappingId);
      if (index === -1) {
        return preset;
      }
      const nextMapping = { ...preset.mappings[index] };
      mutator(nextMapping);
      preset.mappings[index] = nextMapping;
      return preset;
    });
  }

  _resolveMappingId(mapping, index) {
    if (!mapping) return `mapping-${index}`;
    return mapping.id ?? mapping.jointName ?? mapping.bodyName ?? `mapping-${index}`;
  }

  _formatMappingLabel(mapping, index) {
    if (!mapping) {
      return `Mapping ${index + 1}`;
    }
    const body = mapping.bodyName ?? mapping.jointName ?? mapping.id ?? `Mapping ${index + 1}`;
    const feature = mapping.feature?.type ?? "rms";
    const featureLabel =
      feature === "band" || feature === "energy"
        ? `${feature}[${mapping.feature?.index ?? 0}]`
        : feature;
    return `${index + 1}. ${body} ← ${featureLabel}`;
  }

  _updateFeatureIndexVisibility() {
    const requiresIndex = this.mappingState.featureType === "band" || this.mappingState.featureType === "energy";
    this._toggleControllerVisibility(this.mappingControllers.featureIndex, requiresIndex);
  }

  _toggleControllerVisibility(controller, shouldShow) {
    if (!controller?.domElement) return;
    controller.domElement.style.display = shouldShow ? "" : "none";
  }

  _handleRandomPreset() {
    try {
      const preset = this.presetManager.generateRandomPreset({
        trackId: this.presetManager.getActiveTrackId()
      });
      this._setToolMessage(`Generated ${preset.name}`, STATUS_VARIANTS.SUCCESS);
    } catch (error) {
      console.error("UIController: Failed to randomize preset", error);
      this._setToolMessage("Unable to randomize preset", STATUS_VARIANTS.ERROR);
    }
  }

  _handleExportPreset() {
    try {
      const json = this.presetManager.exportPreset();
      if (this.guiElements.textarea) {
        this.guiElements.textarea.value = json;
        this.guiElements.textarea.focus();
        this.guiElements.textarea.select?.();
      }
      this._setToolMessage("Preset JSON exported", STATUS_VARIANTS.INFO);
    } catch (error) {
      console.error("UIController: Failed to export preset", error);
      this._setToolMessage("Unable to export preset", STATUS_VARIANTS.ERROR);
    }
  }

  _handleDownloadPreset() {
    try {
      this.presetManager.downloadPreset();
      this._setToolMessage("Preset download started", STATUS_VARIANTS.SUCCESS);
    } catch (error) {
      console.error("UIController: Failed to download preset", error);
      this._setToolMessage("Unable to download preset", STATUS_VARIANTS.ERROR);
    }
  }

  _handleImportPresetFromText() {
    const value = this.guiElements.textarea?.value?.trim();
    if (!value) {
      this._setToolMessage("Paste preset JSON before importing", STATUS_VARIANTS.WARNING);
      return;
    }
    try {
      const preset = this.presetManager.importPresetFromJson(value, {
        trackId: this.presetManager.getActiveTrackId(),
        makeActive: true
      });
      this._setToolMessage(`Imported ${preset.name} from text`, STATUS_VARIANTS.SUCCESS);
    } catch (error) {
      console.error("UIController: Failed to import preset text", error);
      this._setToolMessage(error?.message ?? "Invalid preset JSON", STATUS_VARIANTS.ERROR);
    }
  }

  _handlePresetFileInput(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    this.presetManager
      .importPresetFromFile(file, {
        trackId: this.presetManager.getActiveTrackId(),
        makeActive: true
      })
      .then((preset) => {
        if (this.guiElements.fileInput) {
          this.guiElements.fileInput.value = "";
        }
        this._setToolMessage(`Imported ${preset.name} from file`, STATUS_VARIANTS.SUCCESS);
      })
      .catch((error) => {
        console.error("UIController: Failed to import preset file", error);
        this._setToolMessage(error?.message ?? "Failed to import file", STATUS_VARIANTS.ERROR);
      });
  }

  _applyParameterChange(key, value) {
    if (!Number.isFinite(value)) return;
    switch (key) {
      case "gravity":
        this._updatePreset((preset) => {
          const gravity = Array.isArray(preset.physics?.gravity)
            ? preset.physics.gravity.slice()
            : [0, PARAM_DEFAULTS.gravity, 0];
          gravity[1] = value;
          preset.physics = preset.physics ?? {};
          preset.physics.gravity = gravity;
          return preset;
        });
        break;
      case "stiffness":
        this._updatePreset((preset) => {
          preset.physics = preset.physics ?? {};
          preset.physics.stiffness = value;
          return preset;
        });
        break;
      case "damping":
        this._updatePreset((preset) => {
          preset.physics = preset.physics ?? {};
          preset.physics.damping = value;
          return preset;
        });
        break;
      default:
        break;
    }
  }

  _updatePreset(mutator) {
    if (typeof mutator !== "function") return;
    try {
      this.presetManager.updateCurrentPreset((preset) => {
        mutator(preset);
        return preset;
      });
    } catch (error) {
      console.warn("UIController: Failed to update preset", error);
    }
  }

  _syncTrackState(track) {
    if (!track || !this.elements.trackSelect) return;
    this._ensureTrackOption(track);
    this.elements.trackSelect.value = track.id;
  }

  _syncPresetState(preset) {
    if (!preset) return;
    if (preset.id) {
      this._setGuiValue("preset", preset.id);
    }
    const physics = preset.physics ?? {};
    const gravityY = Array.isArray(physics.gravity) ? physics.gravity[1] ?? PARAM_DEFAULTS.gravity : PARAM_DEFAULTS.gravity;
    this._setGuiValue("gravity", gravityY);
    this._setGuiValue("damping", physics.damping ?? PARAM_DEFAULTS.damping);
    this._setGuiValue("stiffness", physics.stiffness ?? PARAM_DEFAULTS.stiffness);
    const bg = preset.rendering?.backgroundColor ?? GUI_DEFAULTS.backgroundColor;
    this._setGuiValue("backgroundColor", bg);
    this._refreshMappingGui(preset);
  }

  _ensureTrackOption(track) {
    if (!track?.id || !this.elements.trackSelect) return;
    if (!this._knownTrackIds.has(track.id)) {
      const option = this._buildTrackOption(track);
      this.elements.trackSelect.appendChild(option);
      this._knownTrackIds.add(track.id);
    }
  }

  _buildTrackOption(track) {
    const option = document.createElement("option");
    option.value = track.id;
    const artist = track.artist ? ` — ${track.artist}` : "";
    option.textContent = `${track.title ?? track.id}${artist}`;
    if (track.isUserTrack) {
      option.dataset.userTrack = "true";
    }
    return option;
  }

  _setStatus(message, variant = STATUS_VARIANTS.INFO) {
    this._setGuiValue("status", message ?? "");
    const statusController = this.guiControllers.status;
    if (statusController?.domElement) {
      statusController.domElement.dataset.variant = message ? variant : "";
    }
  }

  _setToolMessage(message, variant = STATUS_VARIANTS.INFO) {
    if (!this.guiElements.message) return;
    this.guiElements.message.textContent = message ?? "";
    this.guiElements.message.dataset.variant = message ? variant : "";
  }

  _setGuiValue(key, value) {
    this.guiState[key] = value;
    const controller = this.guiControllers[key];
    if (!controller) return;
    this._isGuiUpdating = true;
    controller.setValue(value);
    this._isGuiUpdating = false;
  }

  _setMappingGuiValue(key, value) {
    if (!(key in this.mappingState)) {
      this.mappingState[key] = value;
    } else {
      this.mappingState[key] = value;
    }
    const controller = this.mappingControllers[key];
    if (!controller) return;
    this._isGuiUpdating = true;
    controller.setValue(value);
    this._isGuiUpdating = false;
    if (key === "featureType") {
      this._updateFeatureIndexVisibility();
    }
  }
}
