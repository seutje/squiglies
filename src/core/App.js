const PLACEHOLDER_CANVAS_ID = "placeholder-canvas";

export class App {
  constructor({ visualizerContainer, controlsRoot }) {
    this.visualizerContainer = visualizerContainer;
    this.controlsRoot = controlsRoot;

    this.isRunning = false;
    this.lastTimestamp = 0;
    this._rafHandle = null;
    this._boundTick = this._tick.bind(this);
    this._placeholderCtx = null;
  }

  async init() {
    if (!this.visualizerContainer) {
      throw new Error("Visualizer container not found");
    }

    if (!this.controlsRoot) {
      throw new Error("Controls root not found");
    }

    this._setupPlaceholderCanvas();
    this._renderPlaceholderFrame(0);
  }

  start() {
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

    this._renderPlaceholderFrame(deltaSeconds);
    this._rafHandle = requestAnimationFrame(this._boundTick);
  }

  _setupPlaceholderCanvas() {
    let canvas = this.visualizerContainer.querySelector(`#${PLACEHOLDER_CANVAS_ID}`);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = PLACEHOLDER_CANVAS_ID;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      this.visualizerContainer.appendChild(canvas);
    }

    this._placeholderCtx = canvas.getContext("2d");
    this._resizeCanvasToContainer(canvas);

    window.addEventListener("resize", () => this._resizeCanvasToContainer(canvas));
  }

  _resizeCanvasToContainer(canvas) {
    const { clientWidth, clientHeight } = this.visualizerContainer;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, clientWidth * dpr);
    canvas.height = Math.max(1, clientHeight * dpr);
    this._placeholderCtx.setTransform(1, 0, 0, 1, 0, 0);
    this._placeholderCtx.scale(dpr, dpr);
  }

  _renderPlaceholderFrame(deltaSeconds) {
    if (!this._placeholderCtx) return;

    this._placeholderCtx.save();
    this._placeholderCtx.clearRect(
      0,
      0,
      this.visualizerContainer.clientWidth,
      this.visualizerContainer.clientHeight
    );

    const time = performance.now() / 1000;
    const width = this.visualizerContainer.clientWidth;
    const height = this.visualizerContainer.clientHeight;

    const gradient = this._placeholderCtx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#0b1120");
    this._placeholderCtx.fillStyle = gradient;
    this._placeholderCtx.fillRect(0, 0, width, height);

    const pulse = (Math.sin(time * 1.5) + 1) / 2;

    this._placeholderCtx.strokeStyle = "rgba(147, 197, 253, 0.8)";
    this._placeholderCtx.lineWidth = 4;

    const radius = Math.min(width, height) * 0.25 * (0.7 + 0.3 * pulse);
    const centerX = width / 2;
    const centerY = height / 2;

    this._placeholderCtx.beginPath();
    this._placeholderCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this._placeholderCtx.stroke();

    this._placeholderCtx.strokeStyle = "rgba(56, 189, 248, 0.5)";
    this._placeholderCtx.setLineDash([12, 12]);
    this._placeholderCtx.lineDashOffset = time * 30;
    this._placeholderCtx.strokeRect(
      centerX - radius * 1.4,
      centerY - radius * 1.4,
      radius * 2.8,
      radius * 2.8
    );
    this._placeholderCtx.setLineDash([]);

    this._placeholderCtx.fillStyle = "rgba(248, 250, 252, 0.85)";
    this._placeholderCtx.font = "16px Inter, sans-serif";
    this._placeholderCtx.textAlign = "center";
    this._placeholderCtx.fillText("Physics Audio Visualizer", centerX, centerY + radius + 24);

    this._placeholderCtx.restore();
  }
}
