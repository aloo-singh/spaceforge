import type { Point } from "@/lib/editor/types";

export function translateRoomPoints(points: Point[], delta: Point): Point[] {
  return points.map((point) => ({
    x: point.x + delta.x,
    y: point.y + delta.y,
  }));
}
