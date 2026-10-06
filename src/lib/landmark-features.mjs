// ponytail: 90 ≈ 3s at 30fps. Static JSON still 30; live predicts from MIN_FRAMES up.
export const MIN_FRAMES = 30;
export const SAMPLE_FRAMES = 90;
export const POSE_DIM = 63;
export const PATH_TIPS = [4, 8, 12, 16, 20];
export const PATH_POINTS = 8;
export const MOTION_DIM = PATH_TIPS.length * PATH_POINTS * 2;
// ponytail: 8 pts × 5 tips; raise PATH_POINTS if a moving letter collides with another
export const MOTION_MIN_PATH = 0.45;

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

function motionFeatures(frames) {
  const origin = frames[0].landmarks;
  const scale = Math.max(distance(origin[5], origin[17]), 0.0001);
  const zeros = Array.from({ length: MOTION_DIM }, () => 0);
  let pathLength = 0;
  const resampled = [];

  for (const tip of PATH_TIPS) {
    const points = frames.map((frame) => ({
      x: (frame.landmarks[tip].x - origin[tip].x) / scale,
      y: (frame.landmarks[tip].y - origin[tip].y) / scale,
    }));
    for (let index = 1; index < points.length; index++) {
      pathLength += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    }
    resampled.push(resample(points, PATH_POINTS));
  }

  if (pathLength < MOTION_MIN_PATH) return zeros;
  return resampled.flatMap((points) => points.flatMap((point) => [point.x, point.y]));
}

export function framesToFeatures(frames) {
  const window = frames.slice(0, SAMPLE_FRAMES);
  const vectors = window.map((frame) => normalizeLandmarks(frame.landmarks));
  return meanVector(vectors).concat(motionFeatures(window));
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
  assert(stillFeatures.length === POSE_DIM + MOTION_DIM, "feature length");
  assert(
    stillFeatures.slice(POSE_DIM).every((value) => value === 0),
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
    movingFeatures.slice(POSE_DIM).some((value) => value !== 0),
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
    zFeatures.slice(POSE_DIM).some((value) => value !== 0),
    "Z path must be nonzero",
  );
  assert(poseDelta < 0.05, "Z pose must match static pointing");
  assert(pathDelta > 1, "Z path must differ from static");
}
