import type { Point } from "@/lib/editor/types";

export type TransformMode = "move" | "resize";

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
    originalPoints,
    previewPoints,
    originalBounds: getBoundsForPoints(originalPoints),
    previewBounds: getBoundsForPoints(previewPoints),
    snapTarget: options.snapTarget ?? null,
    settleTarget: options.settleTarget ?? null,
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

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ ...point }));
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
