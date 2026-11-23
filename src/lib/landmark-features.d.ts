export const MIN_FRAMES: number;
export const SAMPLE_FRAMES: number;
export const POSE_DIM: number;
export const PATH_TIPS: number[];
export const PATH_POINTS: number;
export const MOTION_DIM: number;
export const MOTION_MIN_EXTENT: number;
export const SHAPE_DIM: number;
export const ORIENTATION_DIM: number;
export const FEATURE_DIM: number;
export const POSE_WEIGHT: number;
export const SHAPE_WEIGHT: number;
export const ORIENTATION_WEIGHT: number;
export const CROSS_WEIGHT: number;
export const CROSS_DIM: number;

export type Landmark = { x: number; y: number; z: number };

export function normalizeLandmarks(landmarks: Landmark[]): number[];
export function framesToFeatures(
  frames: Array<{ landmarks: Landmark[]; handedness?: string }>,
): number[];
export function selfCheck(): void;
