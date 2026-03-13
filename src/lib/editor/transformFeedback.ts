import type { Point } from "@/lib/editor/types";

export type TransformMode = "move" | "resize";
export type TransformPhase = "active" | "settling";

export const TRANSFORM_SETTLE_ROOM_ANIMATION_MS = 180;
export const TRANSFORM_SETTLE_PREVIEW_FADE_MS = 320;
export const TRANSFORM_SETTLE_TOTAL_MS =
  TRANSFORM_SETTLE_ROOM_ANIMATION_MS + TRANSFORM_SETTLE_PREVIEW_FADE_MS;

export type TransformFeedbackBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type TransformFeedbackTarget = {
  points?: Point[] | null;
  bounds?: TransformFeedbackBounds | null;
};

export type TransformFeedback = {
  roomId: string;
  mode: TransformMode;
  phase: TransformPhase;
  phaseStartedAtMs: number;
  originalPoints: Point[];
  previewPoints: Point[];
  originalBounds: TransformFeedbackBounds | null;
  previewBounds: TransformFeedbackBounds | null;
  snapTarget: TransformFeedbackTarget | null;
  settleTarget: TransformFeedbackTarget | null;
};

export function createTransformFeedback(options: {
  roomId: string;
  mode: TransformMode;
  phase?: TransformPhase;
  phaseStartedAtMs?: number;
  originalPoints: Point[];
  previewPoints?: Point[];
  snapTarget?: TransformFeedbackTarget | null;
  settleTarget?: TransformFeedbackTarget | null;
}): TransformFeedback {
  const originalPoints = clonePoints(options.originalPoints);
  const previewPoints = clonePoints(options.previewPoints ?? options.originalPoints);

  return {
    roomId: options.roomId,
    mode: options.mode,
    phase: options.phase ?? "active",
    phaseStartedAtMs: options.phaseStartedAtMs ?? getNowMs(),
    originalPoints,
    previewPoints,
    originalBounds: getBoundsForPoints(originalPoints),
    previewBounds: getBoundsForPoints(previewPoints),
    snapTarget: normalizeTarget(options.snapTarget ?? null),
    settleTarget: normalizeTarget(options.settleTarget ?? null),
  };
}

export function updateTransformFeedbackPreview(
  feedback: TransformFeedback,
  previewPoints: Point[]
): TransformFeedback {
  const nextPreviewPoints = clonePoints(previewPoints);

  return {
    ...feedback,
    previewPoints: nextPreviewPoints,
    previewBounds: getBoundsForPoints(nextPreviewPoints),
  };
}

export function createTransformFeedbackTargetFromPoints(points: Point[]): TransformFeedbackTarget {
  const clonedPoints = clonePoints(points);

  return {
    points: clonedPoints,
    bounds: getBoundsForPoints(clonedPoints),
  };
}

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ ...point }));
}

function normalizeTarget(target: TransformFeedbackTarget | null): TransformFeedbackTarget | null {
  if (!target) return null;

  const points = target.points ? clonePoints(target.points) : null;
  const bounds = target.bounds ?? (points ? getBoundsForPoints(points) : null);

  return {
    points,
    bounds,
  };
}

function getNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getBoundsForPoints(points: Point[]): TransformFeedbackBounds | null {
  if (points.length === 0) return null;

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}
