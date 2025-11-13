import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class CameraController {
  constructor({ container }) {
    this.container = container;
    this.camera = null;
    this.controls = null;
  }

  init(rendererDomElement) {
    if (!this.container) {
      throw new Error("CameraController requires a container element");
    }

    const aspect = this._getAspectRatio();
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 100);
    this.camera.position.set(3.5, 2.5, 5.8);

    const orbitTarget = new THREE.Vector3(0, 0.5, 0);
    const domElement = rendererDomElement ?? this.container;
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.copy(orbitTarget);
  }

  update() {
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
}
