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

export class UIController {
  constructor({ rootElement, audioManager, presetManager, trackRegistry }) {
    this.rootElement = rootElement;
    this.audioManager = audioManager;
    this.presetManager = presetManager;
    this.trackRegistry = trackRegistry;

    this.elements = {};
    this._knownTrackIds = new Set();

    this._handlers = {
      onTrackSelect: (event) => this._handleTrackSelect(event),
      onFileInput: (event) => this._handleFileInput(event),
      onPresetSelect: (event) => this._handlePresetSelect(event),
      onParameterInput: (event) => this._handleParameterInput(event),
      onColorChange: (event) => this._handleColorChange(event),
      onAudioTrackChange: (event) => this._syncTrackState(event.detail?.track),
      onAudioError: (event) =>
        this._setStatus(event.detail?.message ?? "Audio error", STATUS_VARIANTS.ERROR),
      onAudioMessage: (event) => this._handleAudioMessage(event.detail?.message ?? ""),
      onPresetChange: (event) => this._syncPresetState(event.detail?.preset),
      onPresetRegistered: () => this._populatePresetOptions()
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

        <label class="control-label" for="preset-select">Presets</label>
        <select class="preset-select" id="preset-select">
          <option value="">Select a preset…</option>
        </select>

        <div class="parameter-controls">
          <div class="parameter-control" data-param-control="gravity">
            <div class="parameter-head">
              <span>Gravity</span>
              <span class="parameter-value" data-param-value="gravity">${PARAM_DEFAULTS.gravity.toFixed(1)}</span>
            </div>
            <input type="range" min="-30" max="-2" step="0.1" value="${PARAM_DEFAULTS.gravity}" />
          </div>
          <div class="parameter-control" data-param-control="stiffness">
            <div class="parameter-head">
              <span>Rig drive</span>
              <span class="parameter-value" data-param-value="stiffness">${PARAM_DEFAULTS.stiffness.toFixed(2)}</span>
            </div>
            <input type="range" min="0.25" max="2" step="0.05" value="${PARAM_DEFAULTS.stiffness}" />
          </div>
          <div class="parameter-control" data-param-control="damping">
            <div class="parameter-head">
              <span>Rig damping</span>
              <span class="parameter-value" data-param-value="damping">${PARAM_DEFAULTS.damping.toFixed(2)}</span>
            </div>
            <input type="range" min="0.2" max="1.5" step="0.05" value="${PARAM_DEFAULTS.damping}" />
          </div>
        </div>

        <label class="color-control">
          <span>Background</span>
          <input type="color" class="background-input" value="#050505" />
        </label>

        <div class="ui-status" aria-live="polite"></div>
      </div>
    `;
  }

  _cacheElements() {
    this.elements.trackSelect = this.rootElement.querySelector(".track-select");
    this.elements.fileInput = this.rootElement.querySelector(".track-upload-input");
    this.elements.presetSelect = this.rootElement.querySelector(".preset-select");
    this.elements.paramControls = this.rootElement.querySelectorAll("[data-param-control]");
    this.elements.status = this.rootElement.querySelector(".ui-status");
    this.elements.backgroundInput = this.rootElement.querySelector(".background-input");
  }

  _bindDomEvents() {
    this.elements.trackSelect?.addEventListener("change", this._handlers.onTrackSelect);
    this.elements.fileInput?.addEventListener("change", this._handlers.onFileInput);
    this.elements.presetSelect?.addEventListener("change", this._handlers.onPresetSelect);
    this.elements.backgroundInput?.addEventListener("input", this._handlers.onColorChange);
    this.elements.paramControls?.forEach((control) => {
      const input = control.querySelector("input[type='range']");
      if (input) {
        input.addEventListener("input", this._handlers.onParameterInput);
      }
    });
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
    if (!this.elements.presetSelect) return;
    const currentValue = this.elements.presetSelect.value;
    const summaries =
      this.presetManager?.listPresetSummaries?.() ?? [];
    this.elements.presetSelect.innerHTML = '<option value="">Select a preset…</option>';
    summaries.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      const trackSuffix = preset.trackId ? ` – ${preset.trackId}` : "";
      option.textContent = `${preset.name}${trackSuffix}`;
      this.elements.presetSelect.appendChild(option);
    });
    if (currentValue && this.elements.presetSelect.querySelector(`option[value="${currentValue}"]`)) {
      this.elements.presetSelect.value = currentValue;
    } else {
      const activeId = this.presetManager?.getCurrentPreset()?.id;
      if (activeId) {
        this.elements.presetSelect.value = activeId;
      }
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

  _handlePresetSelect(event) {
    const presetId = event.target.value;
    if (!presetId) return;
    const preset = this.presetManager.setCurrentPreset(presetId);
    if (preset) {
      this._setStatus(`Activated ${preset.name}`, STATUS_VARIANTS.INFO);
    }
  }

  _handleParameterInput(event) {
    const control = event.target.closest("[data-param-control]");
    if (!control) return;
    const key = control.getAttribute("data-param-control");
    const value = parseFloat(event.target.value);
    this._updateParameterDisplay(key, value);
    this._applyParameterChange(key, value);
  }

  _handleColorChange(event) {
    const value = event.target.value;
    if (!value) return;
    this._updatePreset((preset) => {
      preset.rendering = preset.rendering ?? {};
      preset.rendering.backgroundColor = value;
      return preset;
    });
  }

  _handleAudioMessage(message) {
    if (!message) return;
    this._setStatus(message, STATUS_VARIANTS.INFO);
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
    if (!preset || !this.elements) return;
    if (this.elements.presetSelect && preset.id) {
      this.elements.presetSelect.value = preset.id;
    }
    const physics = preset.physics ?? {};
    const gravityY = Array.isArray(physics.gravity) ? physics.gravity[1] ?? PARAM_DEFAULTS.gravity : PARAM_DEFAULTS.gravity;
    this._setSliderValue("gravity", gravityY);
    this._setSliderValue("damping", physics.damping ?? PARAM_DEFAULTS.damping);
    this._setSliderValue("stiffness", physics.stiffness ?? PARAM_DEFAULTS.stiffness);

    if (this.elements.backgroundInput && preset.rendering?.backgroundColor) {
      this.elements.backgroundInput.value = preset.rendering.backgroundColor;
    }
  }

  _setSliderValue(key, value) {
    const control = this.rootElement.querySelector(`[data-param-control="${key}"] input[type='range']`);
    if (!control || !Number.isFinite(value)) return;
    control.value = value;
    this._updateParameterDisplay(key, value);
  }

  _updateParameterDisplay(key, value) {
    if (!Number.isFinite(value)) return;
    const display = this.rootElement.querySelector(`[data-param-value="${key}"]`);
    if (!display) return;
    const formatted = key === "gravity" ? value.toFixed(1) : value.toFixed(2);
    display.textContent = formatted;
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
    if (!this.elements.status) return;
    this.elements.status.textContent = message ?? "";
    this.elements.status.dataset.variant = message ? variant : "";
  }
}
