import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class CameraController {
  constructor({ container }) {
    this.container = container;
    this.camera = null;
    this.controls = null;
    this._desiredPosition = new THREE.Vector3();
    this._targetVector = new THREE.Vector3();
    this._autoMotion = {
      enabled: true,
      radius: 12,
      height: 2.8,
      sway: 0.4,
      speed: 0.08,
      easing: 0.08,
      idleTimeout: 4,
      idleTimer: 0,
      elapsed: 0,
      userActive: false
    };
  }

  init(rendererDomElement) {
    if (!this.container) {
      throw new Error("CameraController requires a container element");
    }

    const aspect = this._getAspectRatio();
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 100);
    this.camera.position.set(7, 5, 11.6);

    const orbitTarget = new THREE.Vector3(0, 0.5, 0);
    const domElement = rendererDomElement ?? this.container;
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.copy(orbitTarget);
    this.controls.addEventListener("start", () => {
      this._autoMotion.userActive = true;
      this._autoMotion.idleTimer = 0;
    });
    this.controls.addEventListener("end", () => {
      this._autoMotion.userActive = false;
    });
  }

  update(deltaSeconds = 0) {
    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
      this._applyAutoMotion(deltaSeconds);
    }
    this.controls?.update();
  }

  resize() {
    if (!this.camera) return;
    this.camera.aspect = this._getAspectRatio();
    this.camera.updateProjectionMatrix();
  }

  _getAspectRatio() {
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
    return width / height;
  }

  _applyAutoMotion(deltaSeconds) {
    if (!this._autoMotion.enabled || !this.camera || !this.controls) {
      return;
    }
    this._autoMotion.elapsed += deltaSeconds;
    if (this._autoMotion.userActive) {
      this._autoMotion.idleTimer = 0;
      return;
    }
    this._autoMotion.idleTimer += deltaSeconds;
    if (this._autoMotion.idleTimer < this._autoMotion.idleTimeout) {
      return;
    }
    const phase = this._autoMotion.elapsed * this._autoMotion.speed * Math.PI * 2;
    const wobble = Math.sin(phase * 0.65) * 0.35;
    const radius = this._autoMotion.radius + wobble * 0.4;
    this._desiredPosition.set(
      Math.cos(phase) * radius,
      this._autoMotion.height + Math.sin(phase * 0.8) * this._autoMotion.sway,
      Math.sin(phase) * radius
    );
    const lerpFactor = 1 - Math.pow(1 - this._autoMotion.easing, deltaSeconds * 60);
    this.camera.position.lerp(this._desiredPosition, lerpFactor);
    const targetOffset = Math.sin(phase * 0.4) * 0.2;
    this._targetVector.set(0, 0.5 + targetOffset, 0);
    this.controls.target.lerp(this._targetVector, 0.02);
  }
}
