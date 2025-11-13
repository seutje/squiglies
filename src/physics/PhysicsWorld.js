import * as THREE from "three";
import { loadRapier } from "./loadRapier.js";

export class PhysicsWorld {
  constructor({ scene }) {
    this.scene = scene;

    this.RAPIER = null;
    this.world = null;
    this.eventQueue = null;

    this.fixedTimeStep = 1 / 60;
    this._accumulator = 0;

    this._groundMesh = null;
  }

  async init() {
    await this._loadRapier();
    this._createWorld();
    this._createGround();
  }

  step(deltaSeconds) {
    if (!this.world) return;
    this._accumulator += deltaSeconds;

    while (this._accumulator >= this.fixedTimeStep) {
      this.world.timestep = this.fixedTimeStep;
      this.world.step(this.eventQueue);
      this._accumulator -= this.fixedTimeStep;
    }

  }

  dispose() {
    if (this._groundMesh) {
      if (this._groundMesh.parent) {
        this._groundMesh.parent.remove(this._groundMesh);
      }
      this._groundMesh.geometry.dispose();
      this._groundMesh.material.dispose();
      this._groundMesh = null;
    }
    this.world = null;
  }

  async _loadRapier() {
    if (this.RAPIER) return;
    this.RAPIER = await loadRapier();
  }

  _createWorld() {
    this.world = new this.RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.eventQueue = new this.RAPIER.EventQueue(true);
  }

  _createGround() {
    const rigidBodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1.2, 0);
    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(10, 0.1, 10);

    const body = this.world.createRigidBody(rigidBodyDesc);
    this.world.createCollider(colliderDesc, body);

    const geometry = new THREE.BoxGeometry(20, 0.2, 20);
    const material = new THREE.MeshStandardMaterial({
      color: 0x0a0f1f,
      metalness: 0,
      roughness: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(new THREE.Vector3(0, -1.2, 0));
    mesh.receiveShadow = true;

    this.scene.add(mesh);

    this._groundMesh = mesh;
  }
}
