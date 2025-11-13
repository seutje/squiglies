import * as THREE from "three";
import { clamp, smoothValue } from "../utils/math.js";
import {
  BASELINE_RIG_PRESET,
  JOINT_MAPPING_SCHEMA,
  RIG_BODY_LIMIT,
  RIG_DEFINITION,
  normalizeMappingConfig
} from "../config/rigDefinition.js";

export class AudioDrivenRig {
  constructor({ physicsWorld, scene, maxBodies = RIG_BODY_LIMIT } = {}) {
    this.physicsWorld = physicsWorld;
    this.scene = scene;
    this.maxBodies = maxBodies;

    this.RAPIER = null;
    this.world = null;

    this.bodiesByName = new Map();
    this.jointsByName = new Map();
    this.meshesByHandle = new Map();
    this.initialStates = new Map();
    this.smoothingState = new Map();

    this._currentPreset = BASELINE_RIG_PRESET;
    this._meshGroup = new THREE.Group();
  }

  init() {
    if (!this.physicsWorld?.world || !this.physicsWorld?.RAPIER) {
      throw new Error("AudioDrivenRig requires an initialized PhysicsWorld");
    }
    this.RAPIER = this.physicsWorld.RAPIER;
    this.world = this.physicsWorld.world;

    if (RIG_DEFINITION.bodies.length > this.maxBodies) {
      throw new Error(`Rig definition exceeds stability limit of ${this.maxBodies} bodies`);
    }

    this._buildBodies();
    this._buildJoints();

    if (this.scene && !this.scene.children.includes(this._meshGroup)) {
      this.scene.add(this._meshGroup);
    }
  }

  update(featureFrame, deltaSeconds = 0, preset = null) {
    if (!featureFrame || !this.world) return;
    if (preset) {
      this._currentPreset = preset;
    }
    const activePreset = this._currentPreset ?? BASELINE_RIG_PRESET;
    const mappings = activePreset?.mappings ?? BASELINE_RIG_PRESET.mappings;
    if (!Array.isArray(mappings)) return;

    mappings.forEach((rawMapping) => {
      const mapping = normalizeMappingConfig(rawMapping);
      if (!this._isMappingSupported(mapping)) return;

      const featureValue = this._resolveFeatureValue(featureFrame, mapping.feature);
      const drivenValue = this._computeDriveValue(featureValue, mapping);
      if (!Number.isFinite(drivenValue)) return;

      const smoothed = this._smoothMappingValue(mapping.id ?? mapping.jointName ?? mapping.bodyName, drivenValue, mapping.smoothing);

      if (mapping.mode === "impulse") {
        this._applyImpulse(mapping.bodyName, mapping.axis, smoothed * (mapping.weight ?? 1));
      } else {
        this._applyTorque(mapping.bodyName, mapping.axis, smoothed, mapping, deltaSeconds);
      }
    });
  }

  syncVisuals() {
    if (!this.world || !this.meshesByHandle.size) return;
    this.meshesByHandle.forEach((mesh, handle) => {
      const body = this.world.getRigidBody(handle);
      if (!body) return;
      const translation = body.translation();
      mesh.position.set(translation.x, translation.y, translation.z);
      const rotation = body.rotation();
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });
  }

  resetPose() {
    if (!this.world || !this.initialStates.size) return;
    this.initialStates.forEach((state, handle) => {
      const body = this.world.getRigidBody(handle);
      if (!body) return;
      body.setTranslation(new this.RAPIER.Vector3(...state.translation), true);
      body.setRotation(
        new this.RAPIER.Quaternion(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w),
        true
      );
      body.setLinvel(new this.RAPIER.Vector3(0, 0, 0), true);
      body.setAngvel(new this.RAPIER.Vector3(0, 0, 0), true);
    });
    this.smoothingState.clear();
  }

  dispose() {
    this.meshesByHandle.forEach((mesh) => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    });
    this.meshesByHandle.clear();
    this.bodiesByName.clear();
    this.jointsByName.clear();
    this.initialStates.clear();
    this.smoothingState.clear();
    if (this._meshGroup.parent) {
      this._meshGroup.parent.remove(this._meshGroup);
    }
    this._meshGroup.clear();
  }

  _buildBodies() {
    RIG_DEFINITION.bodies.forEach((bodyDef) => {
      const body = this._createRigidBody(bodyDef);
      this.bodiesByName.set(bodyDef.name, body.handle);
      this.initialStates.set(body.handle, {
        translation: bodyDef.translation.slice(),
        rotation: this._getInitialRotation(bodyDef)
      });
      const mesh = this._createMesh(bodyDef);
      this.meshesByHandle.set(body.handle, mesh);
      this._meshGroup.add(mesh);
    });
  }

  _buildJoints() {
    RIG_DEFINITION.joints.forEach((jointDef) => {
      const joint = this._createJoint(jointDef);
      if (joint) {
        this.jointsByName.set(jointDef.name, joint.handle);
      }
    });
  }

  _createRigidBody(def) {
    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic().setTranslation(...def.translation);
    bodyDesc.setLinearDamping(def.linearDamping ?? 0.5);
    bodyDesc.setAngularDamping(def.angularDamping ?? 0.5);

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this._buildCollider(def);
    if (typeof def.mass === "number") {
      colliderDesc.setMass(def.mass);
    }
    colliderDesc.setRestitution(def.restitution ?? 0.2);
    colliderDesc.setFriction(def.friction ?? 0.9);
    this.world.createCollider(colliderDesc, body);

    const rotation = this._getInitialRotation(def);
    body.setRotation(
      new this.RAPIER.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
      true
    );

    return body;
  }

  _buildCollider(def) {
    if (def.shape === "capsule") {
      const halfHeight = def.size?.halfHeight ?? 0.2;
      const radius = def.size?.radius ?? 0.12;
      return this.RAPIER.ColliderDesc.capsule(halfHeight, radius);
    }
    if (def.shape === "sphere") {
      const radius = def.size?.radius ?? 0.2;
      return this.RAPIER.ColliderDesc.ball(radius);
    }
    const [hx, hy, hz] = (def.size?.halfExtents ?? [0.2, 0.2, 0.2]).map((value) => Math.max(0.05, value));
    return this.RAPIER.ColliderDesc.cuboid(hx, hy, hz);
  }

  _createMesh(def) {
    let geometry;
    if (def.shape === "capsule" && THREE.CapsuleGeometry) {
      const radius = def.size?.radius ?? 0.12;
      const height = (def.size?.halfHeight ?? 0.2) * 2;
      geometry = new THREE.CapsuleGeometry(radius, height, 12, 24);
    } else if (def.shape === "capsule") {
      const radius = def.size?.radius ?? 0.12;
      const height = (def.size?.halfHeight ?? 0.2) * 2;
      geometry = new THREE.CylinderGeometry(radius, radius, height, 12, 1, false);
    } else if (def.shape === "sphere") {
      const radius = def.size?.radius ?? 0.18;
      geometry = new THREE.SphereGeometry(radius, 24, 16);
    } else {
      const [hx, hy, hz] = (def.size?.halfExtents ?? [0.2, 0.2, 0.2]);
      geometry = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.color ?? "#3ec8ff"),
      roughness: 0.35,
      metalness: 0.55,
      emissive: new THREE.Color("#050709"),
      emissiveIntensity: 0.35
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(...def.translation);
    return mesh;
  }

  _createJoint(def) {
    const handleA = this.bodiesByName.get(def.bodyA);
    const handleB = this.bodiesByName.get(def.bodyB);
    if (handleA === undefined || handleB === undefined) {
      console.warn(`AudioDrivenRig: Missing body for joint ${def.name}`);
      return null;
    }

    const bodyA = this.world.getRigidBody(handleA);
    const bodyB = this.world.getRigidBody(handleB);
    if (!bodyA || !bodyB) {
      console.warn(`AudioDrivenRig: Joint bodies not found for ${def.name}`);
      return null;
    }

    const anchorA = new this.RAPIER.Vector3(...(def.anchorA ?? [0, 0, 0]));
    const anchorB = new this.RAPIER.Vector3(...(def.anchorB ?? [0, 0, 0]));

    let jointData;
    switch (def.type) {
      case "fixed": {
        jointData = this.RAPIER.JointData.fixed(
          anchorA,
          new this.RAPIER.Quaternion(0, 0, 0, 1),
          anchorB,
          new this.RAPIER.Quaternion(0, 0, 0, 1)
        );
        break;
      }
      case "spherical":
      default: {
        const sphericalFactory =
          this.RAPIER.JointData.spherical ?? this.RAPIER.JointData.ball ?? null;
        if (!sphericalFactory) {
          console.error("AudioDrivenRig: Rapier build missing JointData.spherical/ball");
          return null;
        }
        jointData = sphericalFactory(anchorA, anchorB);
        break;
      }
    }

    return this.world.createImpulseJoint(jointData, bodyA, bodyB, true);
  }

  _resolveFeatureValue(frame, feature) {
    if (!feature) return frame.rms ?? 0;
    switch (feature.type) {
      case "peak":
        return frame.peak ?? 0;
      case "band": {
        const index = clamp(feature.index ?? 0, 0, frame.bands?.length - 1 || 0);
        return frame.bands?.[index] ?? 0;
      }
      case "energy":
        return frame.energy ?? frame.rms ?? 0;
      case "centroid": {
        const normalized = (frame.centroid ?? 0) / 8000;
        return clamp(normalized, 0, 1);
      }
      case "rolloff": {
        const normalized = (frame.rolloff ?? 0) / 16000;
        return clamp(normalized, 0, 1);
      }
      case "rms":
      default:
        return frame.rms ?? 0;
    }
  }

  _computeDriveValue(value, mapping) {
    const scaled = (mapping.scale ?? 1) * value + (mapping.offset ?? 0);
    const min = Number.isFinite(mapping.min) ? mapping.min : -1;
    const max = Number.isFinite(mapping.max) ? mapping.max : 1;
    return clamp(scaled, min, max);
  }

  _smoothMappingValue(key, value, smoothing = 0.5) {
    const previous = this.smoothingState.get(key);
    const next = previous === undefined ? value : smoothValue(previous, value, smoothing);
    this.smoothingState.set(key, next);
    return next;
  }

  _applyImpulse(bodyName, axis, magnitude) {
    const body = this._getBody(bodyName);
    if (!body) return;
    const direction = this._normalizeAxis(axis);
    const impulse = new this.RAPIER.Vector3(direction[0] * magnitude, direction[1] * magnitude, direction[2] * magnitude);
    body.applyImpulse(impulse, true);
  }

  _applyTorque(bodyName, axis, controlValue, mapping, deltaSeconds) {
    const body = this._getBody(bodyName);
    if (!body) return;
    const direction = this._normalizeAxis(axis);
    const rangeMin = Number.isFinite(mapping.min) ? mapping.min : -1;
    const rangeMax = Number.isFinite(mapping.max) ? mapping.max : 1;
    const normalized =
      rangeMax - rangeMin === 0 ? 0.5 : (controlValue - rangeMin) / (rangeMax - rangeMin);
    const targetAngle = Array.isArray(mapping.targetAngles)
      ? mapping.targetAngles[0] + (mapping.targetAngles[1] - mapping.targetAngles[0]) * clamp(normalized, 0, 1)
      : controlValue;

    const torqueMagnitude = targetAngle * (mapping.weight ?? 1);
    const torque = new this.RAPIER.Vector3(
      direction[0] * torqueMagnitude,
      direction[1] * torqueMagnitude,
      direction[2] * torqueMagnitude
    );

    body.applyTorqueImpulse(torque, true);

    if (mapping.damping) {
      const angVel = body.angvel();
      const projectedVel = angVel.x * direction[0] + angVel.y * direction[1] + angVel.z * direction[2];
      const dampingTorque = -projectedVel * mapping.damping * (deltaSeconds ? Math.max(1, deltaSeconds * 60) : 1);
      const dampingVector = new this.RAPIER.Vector3(
        direction[0] * dampingTorque,
        direction[1] * dampingTorque,
        direction[2] * dampingTorque
      );
      body.applyTorqueImpulse(dampingVector, true);
    }
  }

  _normalizeAxis(axis) {
    const [x = 0, y = 1, z = 0] = Array.isArray(axis) ? axis : [0, 1, 0];
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
  }

  _getInitialRotation(def) {
    if (!def.initialRotation) {
      return { x: 0, y: 0, z: 0, w: 1 };
    }
    const axis = this._normalizeAxis(def.initialRotation.axis);
    const halfAngle = (def.initialRotation.angle ?? 0) * 0.5;
    const sinHalf = Math.sin(halfAngle);
    return {
      x: axis[0] * sinHalf,
      y: axis[1] * sinHalf,
      z: axis[2] * sinHalf,
      w: Math.cos(halfAngle)
    };
  }

  _getBody(name) {
    const handle = this.bodiesByName.get(name);
    if (handle === undefined) return null;
    return this.world.getRigidBody(handle);
  }

  _isMappingSupported(mapping) {
    if (!mapping) return false;
    if (!mapping.bodyName) return false;
    if (!mapping.mode || !JOINT_MAPPING_SCHEMA.mode.includes(mapping.mode)) {
      return false;
    }
    return true;
  }
}
