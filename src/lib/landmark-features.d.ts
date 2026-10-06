export const MIN_FRAMES: number;
export const SAMPLE_FRAMES: number;
export const POSE_DIM: number;
export const PATH_TIPS: number[];
export const PATH_POINTS: number;
export const MOTION_DIM: number;
export const MOTION_MIN_PATH: number;

export type Landmark = { x: number; y: number; z: number };

export function normalizeLandmarks(landmarks: Landmark[]): number[];
export function framesToFeatures(frames: Array<{ landmarks: Landmark[] }>): number[];
export function selfCheck(): void;
