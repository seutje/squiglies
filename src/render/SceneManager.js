import * as THREE from "three";

const DEFAULT_CLEAR_COLOR = 0x05070d;

export class SceneManager {
  constructor({ container }) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.renderer = null;

    this._resizeObserver = null;
    this._fallbackResizeHandler = null;
    this._lights = {
      hemisphere: null,
      key: null,
      rim: null,
      fill: null,
      accent: null
    };
    this._groundMaterial = null;
    this._glowMaterial = null;
    this._elapsedTime = 0;
  }

  init() {
    if (!this.container) {
      throw new Error("SceneManager requires a container element");
    }

    this._setupRenderer();
    this._setupLights();
    this._addGroundPlane();
    this.scene.fog = new THREE.FogExp2(new THREE.Color(0x03050a), 0.06);
    this._resize();

    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this.container);
    } else {
      this._fallbackResizeHandler = () => this._resize();
      window.addEventListener("resize", this._fallbackResizeHandler);
    }
  }

  update(deltaSeconds = 0) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }
    this._elapsedTime += deltaSeconds;
    const wobble = Math.sin(this._elapsedTime * 0.6) * 0.4;
    if (this._lights?.accent) {
      this._lights.accent.intensity = 0.45 + Math.sin(this._elapsedTime * 1.4) * 0.2;
      this._lights.accent.position.x = Math.cos(this._elapsedTime * 0.4) * 2.4;
      this._lights.accent.position.z = Math.sin(this._elapsedTime * 0.4) * 2.4;
    }
    if (this._lights?.rim) {
      this._lights.rim.intensity = 0.3 + Math.sin(this._elapsedTime * 0.9) * 0.08;
    }
    if (this._glowMaterial) {
      this._glowMaterial.opacity = 0.12 + (Math.sin(this._elapsedTime * 1.2) + 1) * 0.08;
    }
    if (this._groundMaterial) {
      this._groundMaterial.emissiveIntensity = 0.15 + (Math.sin(this._elapsedTime * 0.5) + 1) * 0.1;
    }
  }

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
    this._lights.hemisphere = new THREE.HemisphereLight(0x1b365d, 0x020409, 0.45);
    this.scene.add(this._lights.hemisphere);

    this._lights.key = new THREE.SpotLight(0x93c5fd, 1.25, 60, Math.PI / 5, 0.45, 0.8);
    this._lights.key.position.set(7, 10, 6);
    this._lights.key.castShadow = true;
    this._lights.key.shadow.mapSize.set(2048, 2048);
    this._lights.key.shadow.bias = -0.0001;
    this.scene.add(this._lights.key);
    this.scene.add(this._lights.key.target);
    this._lights.key.target.position.set(0, 0.5, 0);

    this._lights.rim = new THREE.DirectionalLight(0xf472b6, 0.35);
    this._lights.rim.position.set(-6, 5, -5);
    this.scene.add(this._lights.rim);

    this._lights.fill = new THREE.PointLight(0x38bdf8, 0.6, 30);
    this._lights.fill.position.set(0, 3.5, 0);
    this.scene.add(this._lights.fill);

    this._lights.accent = new THREE.PointLight(0x22d3ee, 0.45, 18);
    this._lights.accent.position.set(2.5, 2.5, -2);
    this.scene.add(this._lights.accent);
  }

  _addGroundPlane() {
    const radius = 5.5;
    const stageGeometry = new THREE.CircleGeometry(radius, 80);
    stageGeometry.rotateX(-Math.PI / 2);
    this._groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.35,
      roughness: 0.65,
      emissive: new THREE.Color(0x0ea5e9),
      emissiveIntensity: 0.2
    });
    const stage = new THREE.Mesh(stageGeometry, this._groundMaterial);
    stage.receiveShadow = true;
    stage.position.y = -1.1;
    this.scene.add(stage);

    const glowGeometry = new THREE.RingGeometry(radius - 0.4, radius + 0.45, 90);
    glowGeometry.rotateX(-Math.PI / 2);
    this._glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeometry, this._glowMaterial);
    glow.position.y = -1.09;
    this.scene.add(glow);
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
      this.scene.background = targetColor;
      if (this.scene.fog) {
        this.scene.fog.color = targetColor.clone().multiplyScalar(0.35);
      }
    } catch (error) {
      console.warn("SceneManager: Invalid background color", color, error);
    }
  }

  applyRenderingSettings(rendering = {}) {
    if (!rendering || typeof rendering !== "object") return;
    if (rendering.backgroundColor) {
      this.setBackgroundColor(rendering.backgroundColor);
    }
    if (Array.isArray(rendering.colorPalette) && rendering.colorPalette.length) {
      this._applyPalette(rendering.colorPalette);
    }
  }

  _applyPalette(palette) {
    const [primary, secondary, accent] = palette;
    this._setLightColor(this._lights.key, primary ?? secondary);
    this._setLightColor(this._lights.rim, secondary ?? accent);
    this._setLightColor(this._lights.fill, accent ?? primary);
    this._setGroundColor(primary ?? DEFAULT_CLEAR_COLOR);
    this._setGlowColor(accent ?? secondary ?? primary);
  }

  _setLightColor(light, colorValue) {
    if (!light || !colorValue) return;
    try {
      const color = new THREE.Color(colorValue);
      light.color.copy(color);
    } catch (error) {
      console.warn("SceneManager: invalid light color", colorValue, error);
    }
  }

  _setGroundColor(colorValue) {
    if (!this._groundMaterial || !colorValue) return;
    try {
      const color = new THREE.Color(colorValue);
      this._groundMaterial.color.copy(color);
      this._groundMaterial.emissive.copy(color).multiplyScalar(0.2);
    } catch (error) {
      console.warn("SceneManager: invalid ground color", error);
    }
  }

  _setGlowColor(colorValue) {
    if (!this._glowMaterial || !colorValue) return;
    try {
      this._glowMaterial.color.copy(new THREE.Color(colorValue));
    } catch (error) {
      console.warn("SceneManager: invalid glow color", error);
    }
  }
}
