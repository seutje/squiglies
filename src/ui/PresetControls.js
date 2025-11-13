const MESSAGE_VARIANTS = {
  INFO: "info",
  ERROR: "error",
  SUCCESS: "success",
  WARNING: "warning"
};

export class PresetControls {
  constructor({ rootElement, presetManager }) {
    this.rootElement = rootElement;
    this.presetManager = presetManager;
    this.elements = {};
    this._handlers = {
      onRandom: () => this._handleRandom(),
      onExport: () => this._handleExport(),
      onDownload: () => this._handleDownload(),
      onImportText: () => this._handleImportText(),
      onFileChange: (event) => this._handleFileInput(event),
      onPresetChange: (event) => this._syncPresetSummary(event?.detail?.preset ?? this.presetManager?.getCurrentPreset())
    };
  }

  init() {
    if (!this.rootElement) {
      throw new Error("PresetControls requires a root element");
    }
    if (!this.presetManager) {
      throw new Error("PresetControls requires a PresetManager instance");
    }
    this._render();
    this._cacheElements();
    this._attachDomListeners();
    this._attachPresetListeners();
    this._syncPresetSummary(this.presetManager.getCurrentPreset());
  }

  _render() {
    this.rootElement.innerHTML = `
      <div class="preset-controls">
        <div class="preset-current">
          <span class="preset-current-label">Current preset:</span>
          <span class="preset-current-name">Loading…</span>
        </div>
        <div class="preset-button-row">
          <button type="button" class="preset-button" data-role="random">Randomize</button>
          <button type="button" class="preset-button" data-role="export">Show JSON</button>
          <button type="button" class="preset-button" data-role="download">Download JSON</button>
        </div>
        <label class="preset-text-label">
          <span>Preset JSON</span>
          <textarea class="preset-textarea" rows="6" placeholder="Preset JSON will appear here when exported."></textarea>
        </label>
        <div class="preset-import-row">
          <button type="button" class="preset-button" data-role="import-text">Import from text</button>
          <label class="preset-file-label">
            <span>Import from file</span>
            <input type="file" class="preset-file-input" accept="application/json" />
          </label>
        </div>
        <div class="preset-message" aria-live="polite"></div>
      </div>
    `;
  }

  _cacheElements() {
    this.elements.random = this.rootElement.querySelector('[data-role="random"]');
    this.elements.exportBtn = this.rootElement.querySelector('[data-role="export"]');
    this.elements.downloadBtn = this.rootElement.querySelector('[data-role="download"]');
    this.elements.importTextBtn = this.rootElement.querySelector('[data-role="import-text"]');
    this.elements.fileInput = this.rootElement.querySelector(".preset-file-input");
    this.elements.textarea = this.rootElement.querySelector(".preset-textarea");
    this.elements.message = this.rootElement.querySelector(".preset-message");
    this.elements.currentName = this.rootElement.querySelector(".preset-current-name");
  }

  _attachDomListeners() {
    this.elements.random?.addEventListener("click", this._handlers.onRandom);
    this.elements.exportBtn?.addEventListener("click", this._handlers.onExport);
    this.elements.downloadBtn?.addEventListener("click", this._handlers.onDownload);
    this.elements.importTextBtn?.addEventListener("click", this._handlers.onImportText);
    this.elements.fileInput?.addEventListener("change", this._handlers.onFileChange);
  }

  _attachPresetListeners() {
    this.presetManager?.addEventListener("presetchange", this._handlers.onPresetChange);
  }

  _handleRandom() {
    try {
      const preset = this.presetManager.generateRandomPreset({
        trackId: this.presetManager.getActiveTrackId()
      });
      this._syncPresetSummary(preset);
      this._setMessage(`Generated ${preset.name}`, MESSAGE_VARIANTS.SUCCESS);
    } catch (error) {
      console.error("Failed to generate preset", error);
      this._setMessage("Unable to generate preset", MESSAGE_VARIANTS.ERROR);
    }
  }

  _handleExport() {
    try {
      const json = this.presetManager.exportPreset();
      if (this.elements.textarea) {
        this.elements.textarea.value = json;
        this.elements.textarea.focus();
        this.elements.textarea.select?.();
      }
      this._setMessage("Preset JSON exported to textarea", MESSAGE_VARIANTS.INFO);
    } catch (error) {
      console.error("Failed to export preset", error);
      this._setMessage("Unable to export preset", MESSAGE_VARIANTS.ERROR);
    }
  }

  _handleDownload() {
    try {
      this.presetManager.downloadPreset();
      this._setMessage("Preset download triggered", MESSAGE_VARIANTS.SUCCESS);
    } catch (error) {
      console.error("Failed to download preset", error);
      this._setMessage("Unable to download preset", MESSAGE_VARIANTS.ERROR);
    }
  }

  _handleImportText() {
    const value = this.elements.textarea?.value?.trim();
    if (!value) {
      this._setMessage("Paste preset JSON before importing", MESSAGE_VARIANTS.WARNING);
      return;
    }
    try {
      const preset = this.presetManager.importPresetFromJson(value, {
        trackId: this.presetManager.getActiveTrackId(),
        makeActive: true
      });
      this._syncPresetSummary(preset);
      this._setMessage(`Imported ${preset.name}`, MESSAGE_VARIANTS.SUCCESS);
    } catch (error) {
      console.error("Failed to import preset JSON", error);
      this._setMessage(error?.message ?? "Invalid preset JSON", MESSAGE_VARIANTS.ERROR);
    }
  }

  _handleFileInput(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    this.presetManager
      .importPresetFromFile(file, {
        trackId: this.presetManager.getActiveTrackId(),
        makeActive: true
      })
      .then((preset) => {
        if (this.elements.fileInput) {
          this.elements.fileInput.value = "";
        }
        this._syncPresetSummary(preset);
        this._setMessage(`Imported ${preset.name} from file`, MESSAGE_VARIANTS.SUCCESS);
      })
      .catch((error) => {
        console.error("Failed to import preset from file", error);
        this._setMessage(error?.message ?? "Failed to import file", MESSAGE_VARIANTS.ERROR);
      });
  }

  _syncPresetSummary(preset) {
    const summary = preset ?? this.presetManager?.getCurrentPreset();
    if (!summary || !this.elements.currentName) {
      return;
    }
    const track = summary.trackId ? ` – ${summary.trackId}` : "";
    this.elements.currentName.textContent = `${summary.name}${track}`;
  }

  _setMessage(message, variant = MESSAGE_VARIANTS.INFO) {
    if (!this.elements.message) return;
    this.elements.message.textContent = message ?? "";
    this.elements.message.dataset.variant = variant;
  }
}
