import { SceneManager } from "../render/SceneManager.js";
import { CameraController } from "../render/CameraController.js";
import { PhysicsWorld } from "../physics/PhysicsWorld.js";
import { AudioDrivenRig } from "../physics/AudioDrivenRig.js";
import { TrackRegistry } from "../audio/TrackRegistry.js";
import { AudioManager } from "../audio/AudioManager.js";
import { AudioFeatureExtractor } from "../audio/AudioFeatureExtractor.js";
import { TransportControls } from "../ui/TransportControls.js";
import { PresetManager } from "../config/PresetManager.js";
import { UIController } from "../ui/UIController.js";
import { PerformanceMonitor } from "../utils/PerformanceMonitor.js";

export class App {
  constructor({ visualizerContainer, controlsRoot }) {
    this.visualizerContainer = visualizerContainer;
    this.controlsRoot = controlsRoot;

    this.isRunning = false;
    this.lastTimestamp = 0;
    this._rafHandle = null;
    this._boundTick = this._tick.bind(this);
    this._resizeHandler = null;

    this.sceneManager = null;
    this.cameraController = null;
    this.physicsWorld = null;
    this.audioDrivenRig = null;
    this.trackRegistry = null;
    this.audioManager = null;
    this.audioFeatureExtractor = null;
    this.transportControls = null;
    this.presetManager = null;
    this.uiController = null;
    this._isInitialized = false;
    this._featureSubscribers = new Set();
    this._latestFeatureFrame = null;
    this.performanceMonitor = null;
    this._featureSampleInterval = 1 / 60;
    this._featureAccumulator = 0;
    this._fftTier = "high";
  }

  async init() {
    if (!this.visualizerContainer) {
      throw new Error("Visualizer container not found");
    }

    if (!this.controlsRoot) {
      throw new Error("Controls root not found");
    }

    this._clearVisualizerContainer();

    this.sceneManager = new SceneManager({
      container: this.visualizerContainer
    });
    this.sceneManager.init();

    this.cameraController = new CameraController({
      container: this.visualizerContainer
    });
    this.cameraController.init(this.sceneManager.getDomElement());

    this.physicsWorld = new PhysicsWorld({
      scene: this.sceneManager.scene
    });
    await this.physicsWorld.init();

    this.audioDrivenRig = new AudioDrivenRig({
      physicsWorld: this.physicsWorld,
      scene: this.sceneManager.scene
    });
    this.audioDrivenRig.init();

    await this._initAudioLayer();
    this.performanceMonitor = new PerformanceMonitor();
    this._setupResizeHandling();
    this._isInitialized = true;
  }

  start() {
    if (!this._isInitialized) {
      throw new Error("Call init() before start()");
    }

    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this._rafHandle = requestAnimationFrame(this._boundTick);
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  }

  _tick(timestamp) {
    if (!this.isRunning) return;

    const deltaSecondsRaw = (timestamp - this.lastTimestamp) / 1000;
    const deltaSeconds = Math.min(deltaSecondsRaw, 1 / 24);
    this.lastTimestamp = timestamp;

    this._featureAccumulator += Math.max(deltaSecondsRaw, 0);
    let featureFrame = this._latestFeatureFrame;
    if (!featureFrame || this._featureAccumulator >= this._featureSampleInterval) {
      featureFrame = this._updateAudioFeatures();
      this._featureAccumulator = 0;
    }

    const activePreset = this.presetManager?.getCurrentPreset() ?? null;
    this.audioDrivenRig?.update(featureFrame, deltaSeconds, activePreset);
    this.physicsWorld?.step(deltaSeconds);
    this.audioDrivenRig?.syncVisuals();
    this.sceneManager?.update(deltaSeconds);
    this.cameraController?.update(deltaSeconds);
    this.sceneManager?.render(this.cameraController?.camera);
    this._trackPerformance(Math.max(deltaSecondsRaw, 0), timestamp);

    this._rafHandle = requestAnimationFrame(this._boundTick);
  }

  _setupResizeHandling() {
    this._resizeHandler = () => {
      this.sceneManager?.resize();
      this.cameraController?.resize();
    };
    window.addEventListener("resize", this._resizeHandler);
  }

  async _initAudioLayer() {
    this.trackRegistry = new TrackRegistry();
    this.presetManager = new PresetManager();
    this.presetManager.addEventListener("presetchange", (event) => {
      this._applyPresetToSystems(event.detail?.preset);
    });
    this._applyPresetToSystems(this.presetManager.getCurrentPreset());
    try {
      await this.presetManager.loadPresetsForTrackList(this.trackRegistry.listTracks());
    } catch (error) {
      console.warn("Failed to preload presets", error);
    }

    this.audioManager = new AudioManager({ trackRegistry: this.trackRegistry });
    this.audioManager.addEventListener("trackchange", (event) => {
      const track = event.detail?.track ?? null;
      this._handleTrackChanged(track);
    });

    const transportRoot = this._resolveTransportRoot();
    this.transportControls = new TransportControls({
      rootElement: transportRoot,
      audioManager: this.audioManager
    });
    this.transportControls.init();

    const trackRoot = this._resolveTrackRoot();
    this.uiController = new UIController({
      rootElement: trackRoot,
      audioManager: this.audioManager,
      presetManager: this.presetManager,
      trackRegistry: this.trackRegistry
    });
    this.uiController.init();

    try {
      const defaultTrack = await this.audioManager.initDefaultTrack();
      if (defaultTrack?.id) {
        this.presetManager?.setActiveTrack(defaultTrack.id);
      }
      await this._initAudioFeaturePipeline();
    } catch (error) {
      console.warn("Failed to load default track", error);
    }
  }

  _resolveTransportRoot() {
    if (!this.controlsRoot) {
      throw new Error("Controls root not found");
    }
    const target =
      this.controlsRoot.querySelector("[data-ui='transport']") ?? this.controlsRoot;
    return target;
  }

  _resolveTrackRoot() {
    if (!this.controlsRoot) {
      throw new Error("Controls root not found");
    }
    const target = this.controlsRoot.querySelector("[data-ui='tracks']");
    if (!target) {
      throw new Error("Track controls root not found");
    }
    return target;
  }

  _clearVisualizerContainer() {
    if (!this.visualizerContainer) return;
    while (this.visualizerContainer.firstChild) {
      this.visualizerContainer.removeChild(this.visualizerContainer.firstChild);
    }
  }

  onAudioFeatureFrame(listener) {
    if (typeof listener !== "function") {
      throw new Error("Feature frame listener must be a function");
    }
    this._featureSubscribers.add(listener);
    return () => this._featureSubscribers.delete(listener);
  }

  getLatestAudioFeatureFrame() {
    return this._latestFeatureFrame;
  }

  async _initAudioFeaturePipeline() {
    if (!this.audioManager) return;
    try {
      const audioContext = await this.audioManager.getAudioContext();
      this.audioFeatureExtractor = new AudioFeatureExtractor({
        audioContext,
        featureSmoothing: 0.6
      });
      this.audioManager.setFeatureExtractor(this.audioFeatureExtractor);
    } catch (error) {
      console.warn("Audio feature extractor unavailable", error);
    }
  }

  _updateAudioFeatures() {
    if (!this.audioFeatureExtractor) return null;
    const frame = this.audioFeatureExtractor.update();
    if (!frame) return null;
    this._latestFeatureFrame = frame;
    this._notifyFeatureSubscribers(frame);
    return frame;
  }

  _notifyFeatureSubscribers(frame) {
    if (!this._featureSubscribers.size) return;
    this._featureSubscribers.forEach((listener) => {
      try {
        listener(frame);
      } catch (error) {
        console.warn("Feature subscriber error", error);
      }
    });
  }

  _handleTrackChanged(track) {
    this.audioDrivenRig?.resetPose();
    const trackId = typeof track === "string" ? track : track?.id ?? null;
    if (this.presetManager) {
      this.presetManager.setActiveTrack(trackId);
    }
  }

  _applyPresetToSystems(preset) {
    if (!preset) return;
    const physics = preset.physics ?? {};
    if (Array.isArray(physics.gravity)) {
      this.physicsWorld?.setGravity(physics.gravity);
    }
    this.audioDrivenRig?.applyPhysicsTuning(physics);
    this.sceneManager?.applyRenderingSettings(preset.rendering ?? {});
  }

  _trackPerformance(deltaSeconds, timestamp) {
    if (!this.performanceMonitor) return;
    const result = this.performanceMonitor.record(deltaSeconds, timestamp);
    if (!result) return;
    const { didLog, metrics } = result;
    if (didLog && metrics) {
      console.table({
        "avg fps": metrics.fps.toFixed(1),
        "avg frame (ms)": metrics.frameMs.toFixed(2),
        "min frame (ms)": metrics.minMs.toFixed(2),
        "max frame (ms)": metrics.maxMs.toFixed(2)
      });
    }
    this._maybeAdjustFeatureDetail();
  }

  _maybeAdjustFeatureDetail() {
    if (!this.audioFeatureExtractor || !this.performanceMonitor) {
      return;
    }
    const fps = this.performanceMonitor.getAverageFps();
    if (!fps) return;
    let tier = "high";
    if (fps < 48) {
      tier = "medium";
    }
    if (fps < 42) {
      tier = "low";
    }
    if (tier === this._fftTier) {
      return;
    }
    this._fftTier = tier;
    const fftSize = tier === "high" ? 2048 : tier === "medium" ? 1024 : 512;
    const sampleInterval = tier === "high" ? 1 / 60 : tier === "medium" ? 1 / 55 : 1 / 45;
    if (this.audioFeatureExtractor.setFftSize(fftSize)) {
      console.info(
        `[Performance] Switched analyser FFT size to ${fftSize} for ${tier} detail (avg fps ${fps.toFixed(1)})`
      );
    }
    this._featureSampleInterval = sampleInterval;
  }
}
