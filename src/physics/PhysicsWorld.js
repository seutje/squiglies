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
      try {
        if (this.eventQueue) {
          this.world.step(this.eventQueue);
          this._drainEventQueue();
        } else {
          this.world.step();
        }
      } catch (error) {
        console.error("PhysicsWorld: step failed", error);
        this._accumulator = 0;
        break;
      }
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
    this.eventQueue =
      typeof this.RAPIER.EventQueue === "function" ? new this.RAPIER.EventQueue(true) : null;
  }

  _drainEventQueue() {
    if (!this.eventQueue) return;
    if (typeof this.eventQueue.drainContactEvents === "function") {
      this.eventQueue.drainContactEvents(() => {});
    }
    if (typeof this.eventQueue.drainIntersectionEvents === "function") {
      this.eventQueue.drainIntersectionEvents(() => {});
    }
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
    // Keep the physics debug mesh invisible so it doesn't interfere with the stylized floor.
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.visible = false;

    this.scene.add(mesh);

    this._groundMesh = mesh;
  }

  setGravity(vector) {
    if (!this.world) return;
    const target = Array.isArray(vector) && vector.length === 3 ? vector : [0, -9.81, 0];
    const [x, y, z] = target.map((value, index) => {
      if (!Number.isFinite(value)) {
        return index === 1 ? -9.81 : 0;
      }
      return value;
    });
    if ("gravity" in this.world) {
      this.world.gravity = { x, y, z };
      return;
    }
    if (typeof this.world.raw === "function") {
      const rawWorld = this.world.raw();
      if (rawWorld?.rawSetGravity) {
        rawWorld.rawSetGravity({ x, y, z });
      }
    }
  }
}
