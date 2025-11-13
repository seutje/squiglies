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
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    return width / height;
  }
}
