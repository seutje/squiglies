export const RIG_BODY_LIMIT = 50;

export const RIG_DEFINITION = {
  bodies: [
    {
      name: "core",
      shape: "capsule",
      size: { halfHeight: 0.35, radius: 0.22 },
      translation: [0, 0.8, 0],
      mass: 3,
      linearDamping: 0.8,
      angularDamping: 0.8,
      color: "#3ec8ff"
    },
    {
      name: "spineLower",
      shape: "capsule",
      size: { halfHeight: 0.28, radius: 0.18 },
      translation: [0, 1.35, 0],
      mass: 1.7,
      linearDamping: 0.65,
      angularDamping: 0.7,
      color: "#7dd3fc"
    },
    {
      name: "spineMid",
      shape: "capsule",
      size: { halfHeight: 0.24, radius: 0.16 },
      translation: [0, 1.8, 0],
      mass: 1.2,
      linearDamping: 0.6,
      angularDamping: 0.65,
      color: "#a855f7"
    },
    {
      name: "spineUpper",
      shape: "capsule",
      size: { halfHeight: 0.22, radius: 0.14 },
      translation: [0, 2.2, 0],
      mass: 0.9,
      linearDamping: 0.55,
      angularDamping: 0.6,
      color: "#f97316"
    },
    {
      name: "crown",
      shape: "sphere",
      size: { radius: 0.22 },
      translation: [0, 2.55, 0],
      mass: 0.6,
      linearDamping: 0.4,
      angularDamping: 0.55,
      color: "#fde047"
    },
    {
      name: "tailBase",
      shape: "capsule",
      size: { halfHeight: 0.25, radius: 0.12 },
      translation: [0, 0.25, 0],
      mass: 0.8,
      linearDamping: 0.7,
      angularDamping: 0.7,
      color: "#0ea5e9"
    },
    {
      name: "tailTip",
      shape: "sphere",
      size: { radius: 0.14 },
      translation: [0, -0.15, 0],
      mass: 0.4,
      linearDamping: 0.65,
      angularDamping: 0.65,
      color: "#22d3ee"
    }
  ],
  joints: [
    {
      name: "core_spineLower",
      bodyA: "core",
      bodyB: "spineLower",
      type: "spherical",
      anchorA: [0, 0.35, 0],
      anchorB: [0, -0.25, 0],
      limits: { swing: 0.45, twist: 0.4 },
      stiffness: 6,
      damping: 1.1
    },
    {
      name: "spineLower_spineMid",
      bodyA: "spineLower",
      bodyB: "spineMid",
      type: "spherical",
      anchorA: [0, 0.25, 0],
      anchorB: [0, -0.2, 0],
      limits: { swing: 0.5, twist: 0.45 },
      stiffness: 5,
      damping: 1
    },
    {
      name: "spineMid_spineUpper",
      bodyA: "spineMid",
      bodyB: "spineUpper",
      type: "spherical",
      anchorA: [0, 0.22, 0],
      anchorB: [0, -0.2, 0],
      limits: { swing: 0.55, twist: 0.5 },
      stiffness: 4.5,
      damping: 0.9
    },
    {
      name: "spineUpper_crown",
      bodyA: "spineUpper",
      bodyB: "crown",
      type: "spherical",
      anchorA: [0, 0.2, 0],
      anchorB: [0, -0.1, 0],
      limits: { swing: 0.6, twist: 0.55 },
      stiffness: 3.8,
      damping: 0.8
    },
    {
      name: "core_tailBase",
      bodyA: "core",
      bodyB: "tailBase",
      type: "spherical",
      anchorA: [0, -0.35, 0],
      anchorB: [0, 0.25, 0],
      limits: { swing: 0.5, twist: 0.35 },
      stiffness: 4,
      damping: 0.9
    },
    {
      name: "tailBase_tailTip",
      bodyA: "tailBase",
      bodyB: "tailTip",
      type: "spherical",
      anchorA: [0, -0.25, 0],
      anchorB: [0, 0.08, 0],
      limits: { swing: 0.6, twist: 0.35 },
      stiffness: 3,
      damping: 0.8
    }
  ]
};

export const JOINT_MAPPING_SCHEMA = {
  id: "string",
  jointName: "string?",
  bodyName: "string?",
  feature: {
    type: ["rms", "peak", "band", "energy", "centroid", "rolloff"]
  },
  axis: "vec3?",
  mode: ["impulse", "torque"],
  smoothing: { type: "number", default: 0.4, min: 0, max: 0.95 },
  weight: { type: "number", default: 1 },
  damping: { type: "number", default: 0.5 },
  targetAngles: { type: "vec2?", description: "[min,max] radians" },
  neutral: { type: "number?", description: "Baseline for impulse zero-centering" },
  scale: { type: "number", default: 1 },
  offset: { type: "number", default: 0 },
  min: { type: "number?", description: "Value clamp min" },
  max: { type: "number?", description: "Value clamp max" }
};

export const BASELINE_RIG_PRESET = {
  id: "baseline-rig-mapping",
  name: "Baseline Rig Mapping",
  description: "Default mapping proving audio → physics loop",
  mappings: [
    {
      id: "core-pulse",
      bodyName: "core",
      axis: [0, 1, 0],
      mode: "impulse",
      feature: { type: "rms" },
      scale: 1,
      offset: 0,
      smoothing: 0.35,
      min: 0,
      max: 1,
      weight: 1.2,
      damping: 0.1
    },
    {
      id: "bass-sway",
      bodyName: "spineLower",
      axis: [0, 0, 1],
      mode: "torque",
      jointName: "core_spineLower",
      feature: { type: "band", index: 1 },
      scale: 1,
      offset: 0,
      smoothing: 0.5,
      min: -1,
      max: 1,
      weight: 4.8,
      damping: 0.7,
      targetAngles: [-0.55, 0.55]
    },
    {
      id: "mid-spiral",
      bodyName: "spineMid",
      axis: [1, 0, 0],
      mode: "torque",
      jointName: "spineLower_spineMid",
      feature: { type: "band", index: 3 },
      scale: 1,
      smoothing: 0.55,
      min: -1,
      max: 1,
      weight: 3.4,
      damping: 0.6,
      targetAngles: [-0.4, 0.4]
    },
    {
      id: "treble-twist",
      bodyName: "spineUpper",
      axis: [0, 1, 0],
      mode: "torque",
      jointName: "spineMid_spineUpper",
      feature: { type: "band", index: 5 },
      scale: 1,
      smoothing: 0.35,
      min: -1,
      max: 1,
      weight: 2.8,
      damping: 0.5,
      targetAngles: [-0.7, 0.7]
    },
    {
      id: "tail-whip",
      bodyName: "tailTip",
      axis: [1, 0, 0],
      mode: "torque",
      jointName: "tailBase_tailTip",
      feature: { type: "band", index: 0 },
      scale: 1,
      smoothing: 0.6,
      min: -1,
      max: 1,
      weight: 2.6,
      damping: 0.5,
      targetAngles: [-0.8, 0.8]
    }
  ]
};

export function normalizeMappingConfig(mapping) {
  if (!mapping) return null;
  const safe = { ...mapping };
  if (safe.feature) {
    safe.feature = { ...safe.feature };
  }
  if (!safe.axis || safe.axis.length !== 3) {
    safe.axis = [0, 1, 0];
  }
  if (typeof safe.smoothing !== "number") {
    safe.smoothing = 0.4;
  }
  if (typeof safe.weight !== "number") {
    safe.weight = 1;
  }
  if (typeof safe.damping !== "number") {
    safe.damping = 0.4;
  }
  if (!safe.feature) {
    safe.feature = { type: "rms" };
  }
  return safe;
}
