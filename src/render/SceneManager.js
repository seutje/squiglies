import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const DEFAULT_CLEAR_COLOR = 0x05070d;

export class SceneManager {
  constructor({ container }) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.renderer = null;

    this._placeholderMesh = null;
    this._resizeObserver = null;
    this._fallbackResizeHandler = null;
  }

  init() {
    if (!this.container) {
      throw new Error("SceneManager requires a container element");
    }

    this._setupRenderer();
    this._setupLights();
    this._addPlaceholderMesh();
    this._resize();

    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this.container);
    } else {
      this._fallbackResizeHandler = () => this._resize();
      window.addEventListener("resize", this._fallbackResizeHandler);
    }
  }

  update(deltaSeconds) {
    if (!this._placeholderMesh) return;
    const rotationSpeed = 0.6;
    this._placeholderMesh.rotation.y += rotationSpeed * deltaSeconds;
    this._placeholderMesh.rotation.x = Math.sin(performance.now() * 0.0005) * 0.2;
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

  _addPlaceholderMesh() {
    const geometry = new THREE.TorusKnotGeometry(1.2, 0.35, 160, 20);
    const material = new THREE.MeshStandardMaterial({
      color: 0x3ec8ff,
      metalness: 0.3,
      roughness: 0.4
    });

    this._placeholderMesh = new THREE.Mesh(geometry, material);
    this._placeholderMesh.castShadow = true;
    this._placeholderMesh.receiveShadow = true;
    this.scene.add(this._placeholderMesh);

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

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.renderer.setSize(width, height, false);
  }
}
