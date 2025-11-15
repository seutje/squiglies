const AudioState = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  PLAYING: "playing",
  PAUSED: "paused",
  ENDED: "ended",
  ERROR: "error"
};

export class AudioManager extends EventTarget {
  constructor({ trackRegistry }) {
    super();
    this.trackRegistry = trackRegistry;

    this.audioContext = null;
    this.gainNode = null;
    this.sourceNode = null;
    this.featureExtractor = null;
    this._analysisConnected = false;

    this.currentTrack = null;
    this.currentBuffer = null;

    this.playbackStartTime = 0;
    this.pauseOffset = 0;
    this.state = AudioState.IDLE;

    this._bufferCache = new Map();
    this._timeUpdateInterval = null;
    this._contextUnlocked = false;
    this._needsUserUnlock = false;
    this._startDelaySeconds = 1;
    this._delayEpsilon = 1e-3;
  }

  async getAudioContext() {
    return this._ensureAudioContext();
  }

  setFeatureExtractor(extractor) {
    this.featureExtractor = extractor ?? null;
    this._analysisConnected = false;
  }

  needsUserUnlock() {
    return this._needsUserUnlock;
  }

  async initDefaultTrack() {
    const defaultTrack = this.trackRegistry?.getDefaultTrack();
    if (!defaultTrack) {
      throw new Error("Track registry does not contain any tracks");
    }
    await this.loadTrack(defaultTrack.id);
    return defaultTrack;
  }

  getState() {
    return this.state;
  }

  isPlaying() {
    return this.state === AudioState.PLAYING;
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  getDuration() {
    return this.currentBuffer?.duration ?? 0;
  }

  getCurrentTime() {
    if (!this.currentBuffer) return 0;
    if (this.isPlaying()) {
      const ctx = this.audioContext;
      if (!ctx) return this.pauseOffset;
      const elapsed = ctx.currentTime - this.playbackStartTime;
      return Math.min(this.getDuration(), Math.max(0, elapsed));
    }
    return this.pauseOffset;
  }

  async loadTrack(trackId) {
    const nextTrack = this.trackRegistry?.getTrackById(trackId);
    if (!nextTrack) {
      throw new Error(`Unknown track id: ${trackId}`);
    }

    if (this.currentTrack?.id === nextTrack.id && this.currentBuffer) {
      this.seek(0);
      this._setState(AudioState.READY);
      this._emitTimeUpdate();
      return nextTrack;
    }

    this._teardownSource(true);
    this.currentBuffer = null;
    this.currentTrack = null;
    this._setState(AudioState.LOADING);
    this._emitMessage("Loading track...");

    try {
      const buffer = await this._fetchTrackBuffer(nextTrack);
      return this._finalizeBufferLoad(nextTrack, buffer);
    } catch (error) {
      this._setState(AudioState.ERROR);
      this._emitError("Failed to load track", error);
      throw error;
    }
  }

  async loadUserFile(file) {
    if (!file || typeof file.arrayBuffer !== "function") {
      throw new Error("AudioManager.loadUserFile expects a File or Blob with arrayBuffer()");
    }

    this._teardownSource(true);
    this.currentBuffer = null;
    this.currentTrack = null;
    this._setState(AudioState.LOADING);
    this._emitMessage("Decoding audio file...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = await this._ensureAudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      const userTrack = this._buildUserTrackMetadata(file);
      return this._finalizeBufferLoad(userTrack, buffer);
    } catch (error) {
      this._setState(AudioState.ERROR);
      this._emitError("Failed to load audio file", error);
      throw error;
    }
  }

  async play() {
    if (!this.currentBuffer) {
      throw new Error("No track loaded");
    }

    try {
      await this._resumeContext();
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        // Surface to UI but swallow so the caller can decide how to react.
        return;
      }
      this._emitError("Audio context error", error);
      throw error;
    }

    if (this.state === AudioState.PLAYING) return;

    this._createSource();
    try {
      this._startSourceWithOffset({ allowDelay: true });
    } catch (error) {
      this._emitError("Unable to start playback", error);
      throw error;
    }

    this._setState(AudioState.PLAYING);
    this._startTimeUpdates();
  }

  pause() {
    if (this.state !== AudioState.PLAYING) return;
    this.pauseOffset = this.getCurrentTime();
    this._teardownSource(false);
    this._setState(AudioState.PAUSED);
    this._emitTimeUpdate();
  }

  stop() {
    this.pauseOffset = 0;
    this._teardownSource(true);
    if (this.state !== AudioState.IDLE) {
      this._setState(AudioState.IDLE);
    }
  }

  seek(targetSeconds) {
    if (!this.currentBuffer) return;
    const duration = this.getDuration();
    const clamped = Math.min(duration, Math.max(0, targetSeconds));
    this.pauseOffset = clamped;

    if (this.state === AudioState.PLAYING) {
      this._teardownSource(false);
      this._createSource();
      try {
        const allowDelay = clamped <= this._delayEpsilon;
        this._startSourceWithOffset({ allowDelay });
      } catch (error) {
        this._emitError("Failed to seek", error);
        throw error;
      }
    }

    this._emitTimeUpdate();
  }

  async playNextTrack() {
    if (typeof this.trackRegistry?.getNextTrack !== "function") {
      return null;
    }

    const baseTrackId = this.currentTrack?.id ?? null;
    const nextTrack = this.trackRegistry.getNextTrack(baseTrackId);
    if (!nextTrack) {
      return null;
    }

    await this.loadTrack(nextTrack.id);
    await this.play();
    return nextTrack;
  }

  async unlockContext() {
    try {
      await this._resumeContext();
    } catch (error) {
      if (error?.name !== "NotAllowedError") {
        this._emitError("Unable to unlock audio", error);
      }
      throw error;
    }
  }

  _createSource() {
    this._teardownSource(false);
    const ctx = this.audioContext;
    if (!ctx) {
      throw new Error("Audio context is not available");
    }

    const source = ctx.createBufferSource();
    source.buffer = this.currentBuffer;
    this._connectSourceToOutput(source);
    source.onended = () => this._handlePlaybackEnded();
    this.sourceNode = source;
  }

  _handlePlaybackEnded() {
    this.pauseOffset = this.getDuration();
    this._teardownSource(false);
    this._setState(AudioState.ENDED);
    this.dispatchEvent(
      new CustomEvent("trackended", {
        detail: {
          track: this.currentTrack
        }
      })
    );
    this._emitTimeUpdate();
    this._autoAdvanceToNextTrack();
  }

  _teardownSource(resetOffset) {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop(0);
      } catch (error) {
        // Ignore - stopping an already stopped node is safe.
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (resetOffset) {
      this.pauseOffset = 0;
      this.playbackStartTime = 0;
    }

    this._stopTimeUpdates();
  }

  _emitTimeUpdate() {
    const duration = this.getDuration();
    const currentTime = this.getCurrentTime();
    const progress = duration > 0 ? currentTime / duration : 0;
    this.dispatchEvent(
      new CustomEvent("timeupdate", {
        detail: {
          currentTime,
          duration,
          progress
        }
      })
    );
  }

  _emitError(message, error) {
    console.error(message, error);
    this.dispatchEvent(
      new CustomEvent("error", {
        detail: {
          message,
          error
        }
      })
    );
  }

  _emitMessage(message) {
    this.dispatchEvent(
      new CustomEvent("message", {
        detail: { message }
      })
    );
  }

  _setState(nextState) {
    if (this.state === nextState) return;
    this.state = nextState;
    this.dispatchEvent(
      new CustomEvent("statechange", {
        detail: { state: nextState }
      })
    );
  }

  _startTimeUpdates() {
    this._stopTimeUpdates();
    const timerApi = typeof window !== "undefined" ? window : globalThis;
    this._timeUpdateInterval = timerApi.setInterval(() => this._emitTimeUpdate(), 200);
  }

  _stopTimeUpdates() {
    if (this._timeUpdateInterval !== null) {
      const timerApi = typeof window !== "undefined" ? window : globalThis;
      timerApi.clearInterval(this._timeUpdateInterval);
      this._timeUpdateInterval = null;
    }
  }

  async _fetchTrackBuffer(track) {
    if (this._bufferCache.has(track.id)) {
      return this._bufferCache.get(track.id);
    }

    const response = await fetch(track.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch track: ${track.src}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const ctx = await this._ensureAudioContext();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    this._bufferCache.set(track.id, buffer);
    return buffer;
  }

  async _ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  _getGainNode() {
    if (!this.gainNode) {
      const ctx = this.audioContext;
      if (!ctx) {
        throw new Error("Audio context is not available");
      }
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = 1;
      this.gainNode.connect(ctx.destination);
    }
    return this.gainNode;
  }

  _connectSourceToOutput(sourceNode) {
    const destination = this._getGainNode();
    const analysisNode = this.featureExtractor?.getAnalyserNode();

    if (!analysisNode) {
      sourceNode.connect(destination);
      return;
    }

    sourceNode.connect(analysisNode);
    if (!this._analysisConnected) {
      analysisNode.connect(destination);
      this._analysisConnected = true;
    }
  }

  async _resumeContext() {
    const ctx = await this._ensureAudioContext();
    if (ctx.state === "running") {
      this._markContextUnlocked();
      return ctx;
    }

    try {
      await ctx.resume();
      this._needsUserUnlock = false;
      this._markContextUnlocked();
      this.dispatchEvent(new CustomEvent("contextunlocked"));
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        this._needsUserUnlock = true;
        this.dispatchEvent(
          new CustomEvent("unlockrequired", {
            detail: { error }
          })
        );
      }
      throw error;
    }
    return ctx;
  }

  _markContextUnlocked() {
    if (this._contextUnlocked) return;
    this._contextUnlocked = true;
  }

  _finalizeBufferLoad(track, buffer) {
    this.currentTrack = track;
    this.currentBuffer = buffer;
    this.pauseOffset = 0;
    this.playbackStartTime = 0;
    this._setState(AudioState.READY);
    this.dispatchEvent(
      new CustomEvent("trackchange", {
        detail: { track }
      })
    );
    this._emitMessage("");
    this._emitTimeUpdate();
    return track;
  }

  _startSourceWithOffset({ allowDelay = false } = {}) {
    if (!this.sourceNode) {
      throw new Error("Audio source node is not available");
    }
    const ctx = this.audioContext;
    if (!ctx) {
      throw new Error("Audio context is not available");
    }
    const shouldDelay = allowDelay && this._shouldApplyStartDelay();
    const delaySeconds = shouldDelay ? this._startDelaySeconds : 0;
    const scheduledStartTime = ctx.currentTime + delaySeconds;
    this.playbackStartTime = scheduledStartTime - this.pauseOffset;
    this.sourceNode.start(scheduledStartTime, this.pauseOffset);
  }

  _shouldApplyStartDelay() {
    if (!this._startDelaySeconds || this._startDelaySeconds <= 0) {
      return false;
    }
    return Math.abs(this.pauseOffset) <= this._delayEpsilon;
  }

  _buildUserTrackMetadata(file) {
    const baseName =
      typeof file?.name === "string" ? file.name.replace(/\.[^/.]+$/, "") : "Local Track";
    const safeTitle = baseName?.trim() ? baseName.trim() : "Local Track";
    return {
      id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title: safeTitle,
      artist: "User File",
      filename: file?.name ?? "local-audio",
      isUserTrack: true
    };
  }

  _autoAdvanceToNextTrack() {
    if (!this.trackRegistry || this.currentTrack?.isUserTrack) {
      return;
    }
    this.playNextTrack().catch((error) => {
      this._emitError("Failed to advance to next track", error);
    });
  }
}

export { AudioState };
