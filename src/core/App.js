import { SceneManager } from "../render/SceneManager.js";
import { CameraController } from "../render/CameraController.js";
import { PhysicsWorld } from "../physics/PhysicsWorld.js";

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
    this._isInitialized = false;
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

    const deltaSeconds = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    this.physicsWorld?.step(deltaSeconds);
    this.sceneManager?.update(deltaSeconds);
    this.cameraController?.update(deltaSeconds);
    this.sceneManager?.render(this.cameraController?.camera);

    this._rafHandle = requestAnimationFrame(this._boundTick);
  }

  _setupResizeHandling() {
    this._resizeHandler = () => {
      this.sceneManager?.resize();
      this.cameraController?.resize();
    };
    window.addEventListener("resize", this._resizeHandler);
  }

  _clearVisualizerContainer() {
    if (!this.visualizerContainer) return;
    while (this.visualizerContainer.firstChild) {
      this.visualizerContainer.removeChild(this.visualizerContainer.firstChild);
    }
  }
}
