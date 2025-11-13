import * as THREE from "three";

const DEFAULT_CLEAR_COLOR = 0x05070d;

export class SceneManager {
  constructor({ container }) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.renderer = null;

    this._resizeObserver = null;
    this._fallbackResizeHandler = null;
  }

  init() {
    if (!this.container) {
      throw new Error("SceneManager requires a container element");
    }

    this._setupRenderer();
    this._setupLights();
    this._addGroundPlane();
    this._resize();

    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this.container);
    } else {
      this._fallbackResizeHandler = () => this._resize();
      window.addEventListener("resize", this._fallbackResizeHandler);
    }
  }

  update() {}

  render(camera) {
    if (!this.renderer || !camera) return;
    this.renderer.render(this.scene, camera);
  }

  getDomElement() {
    return this.renderer?.domElement ?? null;
  }

  resize() {
    this._resize();
  }

  dispose() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._fallbackResizeHandler) {
      window.removeEventListener("resize", this._fallbackResizeHandler);
      this._fallbackResizeHandler = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentElement === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(DEFAULT_CLEAR_COLOR, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0x6ab5ff, 0.4);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(5, 8, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x88c0ff, 0.4);
    rimLight.position.set(-6, 4, -4);
    this.scene.add(rimLight);
  }

  _addGroundPlane() {
    const groundGeometry = new THREE.CylinderGeometry(4, 4, 0.2, 64);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.y = -1.2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _resize() {
    if (!this.renderer) return;

    const containerWidth = Math.max(1, this.container.clientWidth);
    const containerHeight = Math.max(1, this.container.clientHeight);
    const safeWindow = typeof window !== "undefined" ? window : null;
    const safeDocument = typeof document !== "undefined" ? document : null;
    const viewportWidth = Math.max(
      1,
      safeWindow?.innerWidth ?? safeDocument?.documentElement?.clientWidth ?? containerWidth
    );
    const viewportHeight = Math.max(
      1,
      safeWindow?.innerHeight ?? safeDocument?.documentElement?.clientHeight ?? containerHeight
    );
    const width = Math.min(containerWidth, viewportWidth);
    const height = Math.min(containerHeight, viewportHeight);

    this.renderer.setSize(width, height, false);
  }

  setBackgroundColor(color) {
    if (!this.renderer) return;
    try {
      const targetColor = color ? new THREE.Color(color) : new THREE.Color(DEFAULT_CLEAR_COLOR);
      this.renderer.setClearColor(targetColor, 1);
    } catch (error) {
      console.warn("SceneManager: Invalid background color", color, error);
    }
  }
}
