import { AudioState } from "../audio/AudioManager.js";

const DEFAULT_TIME = "0:00";
const MESSAGE_VARIANTS = {
  INFO: "info",
  ERROR: "error",
  WARNING: "warning"
};

export class TransportControls {
  constructor({ rootElement, audioManager }) {
    this.rootElement = rootElement;
    this.audioManager = audioManager;

    this.elements = {};
    this._isScrubbing = false;

    this._handlers = {
      onPlayPause: () => this._handlePlayPause(),
      onSeekInput: (event) => this._handleSeekInput(event),
      onSeekChange: (event) => this._handleSeekCommit(event),
      onStateChange: (event) => this._handleStateChange(event.detail?.state),
      onTimeUpdate: (event) => this._updateTimeUI(event.detail),
      onTrackChange: (event) => this._updateTrackDisplay(event.detail?.track),
      onUnlockRequired: () => this._showUnlockPrompt(),
      onContextUnlocked: () => this._clearUnlockPrompt(),
      onError: (event) => this._setMessage(event.detail?.message ?? "Audio error", MESSAGE_VARIANTS.ERROR),
      onInfoMessage: (event) => this._setMessage(event.detail?.message ?? "", MESSAGE_VARIANTS.INFO),
      onTrackEnded: () => this._handleTrackEnded(),
      onUnlockButton: () => this._requestUnlock()
    };
  }

  init() {
    if (!this.rootElement) {
      throw new Error("TransportControls requires a root element");
    }
    if (!this.audioManager) {
      throw new Error("TransportControls requires an AudioManager instance");
    }

    this._render();
    this._cacheElements();
    this._attachDomListeners();
    this._attachAudioListeners();
    this._syncInitialState();
  }

  _render() {
    this.rootElement.innerHTML = `
      <div class="transport-controls">
        <div class="transport-head">
          <button type="button" class="transport-button" aria-label="Play or pause audio">
            <span class="transport-button-icon" aria-hidden="true">&#9658;</span>
            <span class="transport-button-label">Play</span>
          </button>
          <div class="transport-track-info">
            <div class="transport-track-title">Preparing audio…</div>
            <div class="transport-time" aria-label="Playback time">
              <span class="transport-current">${DEFAULT_TIME}</span>
              <span class="transport-divider">/</span>
              <span class="transport-duration">${DEFAULT_TIME}</span>
            </div>
          </div>
        </div>
        <label class="sr-only" for="transport-seek">Seek within track</label>
        <input id="transport-seek" type="range" class="transport-seek" min="0" max="1" step="0.001" value="0" />
        <div class="transport-message" role="status" aria-live="polite">
          <span class="transport-message-text"></span>
          <button type="button" class="transport-unlock" hidden>Unlock audio</button>
        </div>
      </div>
    `;
  }

  _cacheElements() {
    this.elements.playPause = this.rootElement.querySelector(".transport-button");
    this.elements.buttonLabel = this.rootElement.querySelector(".transport-button-label");
    this.elements.buttonIcon = this.rootElement.querySelector(".transport-button-icon");
    this.elements.trackTitle = this.rootElement.querySelector(".transport-track-title");
    this.elements.currentTime = this.rootElement.querySelector(".transport-current");
    this.elements.duration = this.rootElement.querySelector(".transport-duration");
    this.elements.seek = this.rootElement.querySelector(".transport-seek");
    this.elements.message = this.rootElement.querySelector(".transport-message-text");
    this.elements.messageWrapper = this.rootElement.querySelector(".transport-message");
    this.elements.unlockButton = this.rootElement.querySelector(".transport-unlock");
  }

  _attachDomListeners() {
    this.elements.playPause?.addEventListener("click", this._handlers.onPlayPause);
    this.elements.seek?.addEventListener("input", this._handlers.onSeekInput);
    this.elements.seek?.addEventListener("change", this._handlers.onSeekChange);
    this.elements.unlockButton?.addEventListener("click", this._handlers.onUnlockButton);
  }

  _attachAudioListeners() {
    const manager = this.audioManager;
    manager.addEventListener("statechange", this._handlers.onStateChange);
    manager.addEventListener("timeupdate", this._handlers.onTimeUpdate);
    manager.addEventListener("trackchange", this._handlers.onTrackChange);
    manager.addEventListener("trackended", this._handlers.onTrackEnded);
    manager.addEventListener("unlockrequired", this._handlers.onUnlockRequired);
    manager.addEventListener("contextunlocked", this._handlers.onContextUnlocked);
    manager.addEventListener("error", this._handlers.onError);
    manager.addEventListener("message", this._handlers.onInfoMessage);
  }

  _syncInitialState() {
    const track = this.audioManager.getCurrentTrack();
    if (track) {
      this._updateTrackDisplay(track);
    }
    const duration = this.audioManager.getDuration();
    const current = this.audioManager.getCurrentTime();
    this._updateTimeUI({
      currentTime: current,
      duration,
      progress: duration > 0 ? current / duration : 0
    });
    this._handleStateChange(this.audioManager.getState());
  }

  _handlePlayPause() {
    if (!this.audioManager) return;
    if (this.audioManager.isPlaying()) {
      this.audioManager.pause();
      return;
    }

    this.audioManager.play().catch((error) => {
      if (error?.name === "NotAllowedError") {
        this._showUnlockPrompt();
      } else {
        this._setMessage("Failed to start playback", MESSAGE_VARIANTS.ERROR);
      }
    });
  }

  _handleStateChange(nextState) {
    const isLoading = nextState === AudioState.LOADING;
    const isReady = nextState === AudioState.READY || nextState === AudioState.PAUSED || nextState === AudioState.ENDED;
    const isPlaying = nextState === AudioState.PLAYING;

    if (this.elements.playPause) {
      this.elements.playPause.disabled = isLoading;
      this.elements.buttonLabel.textContent = isPlaying ? "Pause" : "Play";
      this.elements.buttonIcon.innerHTML = isPlaying ? "&#10074;&#10074;" : "&#9658;";
    }

    if (this.elements.seek) {
      this.elements.seek.disabled = !isPlaying && !isReady;
    }

    if (nextState === AudioState.LOADING) {
      this._setMessage("Loading track…", MESSAGE_VARIANTS.INFO);
    } else if (nextState === AudioState.ERROR) {
      this._setMessage("Audio error", MESSAGE_VARIANTS.ERROR);
    } else if (nextState === AudioState.PLAYING) {
      this._setMessage("");
    }
  }

  _handleSeekInput(event) {
    if (!this.audioManager || !this.elements.seek) return;
    this._isScrubbing = true;
    const progress = parseFloat(event.target.value);
    const duration = this.audioManager.getDuration();
    const previewTime = duration * progress;
    this._updateTimeUI({
      currentTime: previewTime,
      duration,
      progress
    });
  }

  _handleSeekCommit(event) {
    if (!this.audioManager || !this.elements.seek) return;
    const progress = parseFloat(event.target.value);
    const duration = this.audioManager.getDuration();
    const nextTime = duration * progress;
    this.audioManager.seek(nextTime);
    this._isScrubbing = false;
  }

  _updateTimeUI({ currentTime = 0, duration = 0, progress = 0 }) {
    if (!Number.isFinite(currentTime)) currentTime = 0;
    if (!Number.isFinite(duration)) duration = 0;

    if (this._isScrubbing) {
      this._updateTimeLabels(currentTime, duration);
      return;
    }

    if (this.elements.seek && Number.isFinite(progress)) {
      this.elements.seek.value = `${Math.min(1, Math.max(0, progress))}`;
    }
    this._updateTimeLabels(currentTime, duration);
  }

  _updateTimeLabels(current, duration) {
    if (this.elements.currentTime) {
      this.elements.currentTime.textContent = formatTime(current);
    }
    if (this.elements.duration) {
      this.elements.duration.textContent = duration > 0 ? formatTime(duration) : DEFAULT_TIME;
    }
  }

  _updateTrackDisplay(track) {
    if (!track || !this.elements.trackTitle) return;
    const artist = track.artist ? ` — ${track.artist}` : "";
    this.elements.trackTitle.textContent = `${track.title}${artist}`;
  }

  _handleTrackEnded() {
    this._handleStateChange(AudioState.ENDED);
  }

  _showUnlockPrompt() {
    if (!this.elements.messageWrapper || !this.elements.unlockButton) return;
    this.elements.unlockButton.hidden = false;
    this.elements.unlockButton.disabled = false;
    this._setMessage("Tap to unlock audio playback", MESSAGE_VARIANTS.WARNING);
  }

  _clearUnlockPrompt() {
    if (!this.elements.unlockButton) return;
    this.elements.unlockButton.hidden = true;
    this._setMessage("");
  }

  _requestUnlock() {
    if (!this.audioManager) return;
    this.audioManager
      .unlockContext()
      .then(() => {
        this._clearUnlockPrompt();
      })
      .catch(() => {
        this._setMessage("Still waiting for audio unlock…", MESSAGE_VARIANTS.WARNING);
      });
  }

  _setMessage(message, variant = MESSAGE_VARIANTS.INFO) {
    if (!this.elements.message || !this.elements.messageWrapper) return;
    this.elements.message.textContent = message;
    this.elements.messageWrapper.dataset.variant = message ? variant : "";
    const showUnlock = variant === MESSAGE_VARIANTS.WARNING && this.audioManager?.needsUserUnlock();
    if (this.elements.unlockButton) {
      this.elements.unlockButton.hidden = !showUnlock;
    }
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return DEFAULT_TIME;
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
