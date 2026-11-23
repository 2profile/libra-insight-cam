// ponytail: 90 ≈ 3s at 30fps. Static JSON still 30; live predicts from MIN_FRAMES up.
export const MIN_FRAMES = 30;
export const SAMPLE_FRAMES = 90;
export const POSE_DIM = 63;
export const PATH_TIPS = [4, 8, 12, 16, 20];
export const PATH_POINTS = 8;
export const MOTION_DIM = PATH_TIPS.length * PATH_POINTS * 2;
export const SHAPE_DIM = 15 + 10 + 5 + 4;
export const ORIENTATION_DIM = 3;
export const CROSS_DIM = 1;
export const FEATURE_DIM = POSE_DIM + MOTION_DIM + SHAPE_DIM + ORIENTATION_DIM + CROSS_DIM;
// ponytail: 8 pts × 5 tips; raise PATH_POINTS if a moving letter collides with another
// Smoothed fingertip travel, in palm widths. Static letters stay below ~1 (tremor),
// moving letters (J, Z, H, K) go from ~1.7 up, so motion is zeroed below this.
export const MOTION_MIN_EXTENT = 1.3;
// Pose (raw landmark positions) varies a lot between people; shape (joint angles,
// fingertip distances) and orientation carry the letter. Weights tuned with
// leave-one-recording-out evaluation.
export const POSE_WEIGHT = 0.5;
export const SHAPE_WEIGHT = 2;
export const ORIENTATION_WEIGHT = 2;
// Index/middle tip offset measured along the index→middle knuckle axis:
// R (crossed) < 0, U (together) ≈ 0.6, V (spread) > 2. Distances alone lose the sign.
export const CROSS_WEIGHT = 4;
const SMOOTH_RADIUS = 4;
const FINGER_CHAINS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function normalizeLandmarks(landmarks) {
  const wrist = landmarks[0];
  const scale = Math.max(distance(landmarks[5], landmarks[17]), 0.0001);
  return landmarks.flatMap((point) => [
    (point.x - wrist.x) / scale,
    (point.y - wrist.y) / scale,
    (point.z - wrist.z) / scale,
  ]);
}

function meanVector(vectors) {
  const size = vectors[0].length;
  return Array.from({ length: size }, (_, index) => {
    const total = vectors.reduce((sum, vector) => sum + vector[index], 0);
    return total / vectors.length;
  });
}

function resample(points, count) {
  if (!points.length) return Array.from({ length: count }, () => ({ x: 0, y: 0 }));
  if (points.length === 1) return Array.from({ length: count }, () => ({ ...points[0] }));

  return Array.from({ length: count }, (_, index) => {
    const t = (index * (points.length - 1)) / (count - 1);
    const start = Math.floor(t);
    const end = Math.min(points.length - 1, start + 1);
    const frac = t - start;
    return {
      x: points[start].x + (points[end].x - points[start].x) * frac,
      y: points[start].y + (points[end].y - points[start].y) * frac,
    };
  });
}

// Largest smoothed bounding-box diagonal of any fingertip path, in 2D palm widths.
function motionExtent(frames) {
  const origin = frames[0].landmarks;
  const scale = Math.max(Math.hypot(origin[5].x - origin[17].x, origin[5].y - origin[17].y), 0.0001);
  let extent = 0;
  for (const tip of PATH_TIPS) {
    const points = frames.map((frame) => frame.landmarks[tip]);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < points.length; index++) {
      const window = points.slice(Math.max(0, index - SMOOTH_RADIUS), index + SMOOTH_RADIUS + 1);
      const x = window.reduce((sum, point) => sum + point.x, 0) / window.length;
      const y = window.reduce((sum, point) => sum + point.y, 0) / window.length;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    extent = Math.max(extent, Math.hypot(maxX - minX, maxY - minY) / scale);
  }
  return extent;
}

function motionFeatures(frames) {
  if (motionExtent(frames) < MOTION_MIN_EXTENT) return Array.from({ length: MOTION_DIM }, () => 0);

  const origin = frames[0].landmarks;
  const scale = Math.max(distance(origin[5], origin[17]), 0.0001);
  return PATH_TIPS.flatMap((tip) => {
    const points = frames.map((frame) => ({
      x: (frame.landmarks[tip].x - origin[tip].x) / scale,
      y: (frame.landmarks[tip].y - origin[tip].y) / scale,
    }));
    return resample(points, PATH_POINTS).flatMap((point) => [point.x, point.y]);
  });
}

function subtract(a, b) {
  return [a.x - b.x, a.y - b.y, a.z - b.z];
}

function angleBetween(u, v) {
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const norm = Math.hypot(...u) * Math.hypot(...v) + 1e-9;
  return Math.acos(Math.max(-1, Math.min(1, dot / norm)));
}

// Rotation- and scale-invariant: joint bend angles plus fingertip distances.
function shapeVector(landmarks) {
  const scale = Math.max(distance(landmarks[5], landmarks[17]), 0.0001);
  const out = [];
  for (const chain of FINGER_CHAINS) {
    for (let index = 1; index < chain.length - 1; index++) {
      out.push(
        angleBetween(
          subtract(landmarks[chain[index]], landmarks[chain[index - 1]]),
          subtract(landmarks[chain[index + 1]], landmarks[chain[index]]),
        ),
      );
    }
  }
  for (let a = 0; a < PATH_TIPS.length; a++) {
    for (let b = a + 1; b < PATH_TIPS.length; b++) {
      out.push(distance(landmarks[PATH_TIPS[a]], landmarks[PATH_TIPS[b]]) / scale);
    }
  }
  for (const tip of PATH_TIPS) out.push(distance(landmarks[tip], landmarks[0]) / scale);
  for (const knuckle of [5, 9, 13, 17]) out.push(distance(landmarks[4], landmarks[knuckle]) / scale);
  return out;
}

// Wrist→middle knuckle direction in the image plane, plus which way the palm faces.
function orientationVector(landmarks) {
  const up = subtract(landmarks[9], landmarks[0]);
  const planar = Math.hypot(up[0], up[1]) + 1e-9;
  const a = subtract(landmarks[5], landmarks[0]);
  const b = subtract(landmarks[17], landmarks[0]);
  const normal = (a[0] * b[1] - a[1] * b[0]) / (Math.hypot(...a) * Math.hypot(...b) + 1e-9);
  return [up[0] / planar, up[1] / planar, normal];
}

function crossValue(landmarks) {
  const bx = landmarks[5].x - landmarks[9].x;
  const by = landmarks[5].y - landmarks[9].y;
  const tx = landmarks[8].x - landmarks[12].x;
  const ty = landmarks[8].y - landmarks[12].y;
  const value = (tx * bx + ty * by) / (bx * bx + by * by + 1e-9);
  return Math.max(-3, Math.min(4, value));
}

// Left hands are mirrored so both hands share one set of prototypes.
function mirrorLeftHand(frames) {
  const left = frames.filter((frame) => frame.handedness === "Left").length;
  if (left * 2 <= frames.length) return frames;
  return frames.map((frame) => ({
    ...frame,
    landmarks: frame.landmarks.map((point) => ({ x: -point.x, y: point.y, z: point.z })),
  }));
}

const scaled = (vector, weight) => vector.map((value) => value * weight);

export function framesToFeatures(frames) {
  const window = mirrorLeftHand(frames.slice(0, SAMPLE_FRAMES));
  const pose = meanVector(window.map((frame) => normalizeLandmarks(frame.landmarks)));
  const shape = meanVector(window.map((frame) => shapeVector(frame.landmarks)));
  const orientation = meanVector(window.map((frame) => orientationVector(frame.landmarks)));
  return [
    ...scaled(pose, POSE_WEIGHT),
    ...motionFeatures(window),
    ...scaled(shape, SHAPE_WEIGHT),
    ...scaled(orientation, ORIENTATION_WEIGHT),
    meanVector(window.map((frame) => [crossValue(frame.landmarks)]))[0] * CROSS_WEIGHT,
  ];
}

function pointingHand(ox = 0, oy = 0) {
  return Array.from({ length: 21 }, (_, index) => ({
    x: index * 0.01 + ox,
    y: index * 0.01 + oy,
    z: 0,
  }));
}

function zOffset(index, count) {
  const t = index / (count - 1);
  const width = 0.25;
  const height = 0.25;
  if (t < 1 / 3) return { x: t * 3 * width, y: 0 };
  if (t < 2 / 3) {
    const u = (t - 1 / 3) * 3;
    return { x: width - u * width, y: u * height };
  }
  const u = (t - 2 / 3) * 3;
  return { x: u * width, y: height };
}

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

export function selfCheck() {
  const still = Array.from({ length: SAMPLE_FRAMES }, () => ({ landmarks: pointingHand() }));
  const stillFeatures = framesToFeatures(still);
  assert(stillFeatures.length === FEATURE_DIM, "feature length");
  assert(
    stillFeatures.slice(POSE_DIM, POSE_DIM + MOTION_DIM).every((value) => value === 0),
    "static path must be zero",
  );
  const legacy = framesToFeatures(
    Array.from({ length: MIN_FRAMES }, () => ({ landmarks: pointingHand() })),
  );
  assert(legacy.length === stillFeatures.length, "legacy 30-frame length");

  const moving = Array.from({ length: SAMPLE_FRAMES }, (_, index) => ({
    landmarks: pointingHand(index * 0.02, 0),
  }));
  const movingFeatures = framesToFeatures(moving);
  assert(
    movingFeatures.slice(POSE_DIM, POSE_DIM + MOTION_DIM).some((value) => value !== 0),
    "moving path must be nonzero",
  );

  // Z: same finger pose, whole hand draws Z. Pose stays; only path changes.
  const zed = Array.from({ length: SAMPLE_FRAMES }, (_, index) => {
    const offset = zOffset(index, SAMPLE_FRAMES);
    return { landmarks: pointingHand(offset.x, offset.y) };
  });
  const zFeatures = framesToFeatures(zed);
  const poseDelta = stillFeatures
    .slice(0, POSE_DIM)
    .reduce((sum, value, index) => sum + (value - zFeatures[index]) ** 2, 0);
  const pathDelta = zFeatures
    .slice(POSE_DIM)
    .reduce((sum, value, index) => sum + (value - stillFeatures[POSE_DIM + index]) ** 2, 0);
  assert(
    zFeatures.slice(POSE_DIM, POSE_DIM + MOTION_DIM).some((value) => value !== 0),
    "Z path must be nonzero",
  );
  assert(poseDelta < 0.05, "Z pose must match static pointing");
  assert(pathDelta > 1, "Z path must differ from static");

  const right = Array.from({ length: SAMPLE_FRAMES }, () => ({ landmarks: pointingHand(), handedness: "Right" }));
  const left = right.map((frame) => ({
    handedness: "Left",
    landmarks: frame.landmarks.map((point) => ({ x: -point.x, y: point.y, z: point.z })),
  }));
  const rightFeatures = framesToFeatures(right);
  const mirrorDelta = framesToFeatures(left).reduce(
    (sum, value, index) => sum + (value - rightFeatures[index]) ** 2,
    0,
  );
  assert(mirrorDelta < 1e-9, "left hand must mirror onto right");
}
