import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const RAPIER_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/rapier3d-compat.es.js";

export class PhysicsWorld {
  constructor({ scene }) {
    this.scene = scene;

    this.RAPIER = null;
    this.world = null;
    this.eventQueue = null;

    this.fixedTimeStep = 1 / 60;
    this._accumulator = 0;

    this._debugMeshes = [];
  }

  async init() {
    await this._loadRapier();
    this._createWorld();
    this._createGround();
    this._createDebugStack();
  }

  step(deltaSeconds) {
    if (!this.world) return;
    this._accumulator += deltaSeconds;

    while (this._accumulator >= this.fixedTimeStep) {
      this.world.timestep = this.fixedTimeStep;
      this.world.step(this.eventQueue);
      this._accumulator -= this.fixedTimeStep;
    }

    this._syncDebugMeshes();
  }

  dispose() {
    this._debugMeshes.forEach(({ mesh }) => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this._debugMeshes = [];
    this.world = null;
  }

  async _loadRapier() {
    if (this.RAPIER) return;
    const mod = await import(RAPIER_MODULE_URL);
    this.RAPIER = mod.default ?? mod;
    if (typeof this.RAPIER.init === "function") {
      await this.RAPIER.init();
    }
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

    this._debugMeshes.push({
      mesh,
      bodyHandle: body.handle
    });
  }

  _createDebugStack() {
    const boxGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const colors = [0x3ec8ff, 0xff8a5b, 0x9b5cf5, 0x7dd3fc];

    for (let i = 0; i < 3; i += 1) {
      const rigidBodyDesc = this.RAPIER.RigidBodyDesc.dynamic().setTranslation(0, i * 0.8 + 0.5, 0);
      rigidBodyDesc.setAngularDamping(0.8);

      const body = this.world.createRigidBody(rigidBodyDesc);
      const colliderDesc = this.RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setRestitution(0.2);
      this.world.createCollider(colliderDesc, body);

      const material = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        metalness: 0.2,
        roughness: 0.4
      });
      const mesh = new THREE.Mesh(boxGeometry.clone(), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.scene.add(mesh);

      this._debugMeshes.push({
        mesh,
        bodyHandle: body.handle
      });
    }
  }

  _syncDebugMeshes() {
    if (!this.world || !this._debugMeshes.length) return;

    this._debugMeshes.forEach(({ mesh, bodyHandle }) => {
      const body = this.world.getRigidBody(bodyHandle);
      if (!body) return;

      const translation = body.translation();
      mesh.position.set(translation.x, translation.y, translation.z);

      const rotation = body.rotation();
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });
  }
}
