import { worldToScreen } from "@/lib/editor/camera";
import { getOrthogonalSegmentAxis } from "@/lib/editor/geometry";
import { isSimplePolygon } from "@/lib/editor/roomGeometry";
import { isSupportedDrawPointPath } from "@/lib/editor/snapping";
import type { CameraState, Point, Room, ScreenPoint, ViewportSize } from "@/lib/editor/types";

export const VERTEX_DELETE_HANDLE_OFFSET_PX = 22;
const VERTEX_DELETE_HANDLE_HIT_RADIUS_PX = 14;

/**
 * Computes the screen-space centre of the "×" delete handle for the given
 * vertex, offset outward from the room centroid so it never overlaps the
 * drag handle square.
 */
export function getVertexDeleteHandleCenter(
  room: Room,
  vertexIndex: number,
  camera: CameraState,
  viewport: ViewportSize
): ScreenPoint | null {
  if (vertexIndex < 0 || vertexIndex >= room.points.length) return null;

  const vertexWorld = room.points[vertexIndex];
  const vertexScreen = worldToScreen(vertexWorld, camera, viewport);

  const centroidWorld = room.points.reduce(
    (acc, p) => ({
      x: acc.x + p.x / room.points.length,
      y: acc.y + p.y / room.points.length,
    }),
    { x: 0, y: 0 }
  );
  const centroidScreen = worldToScreen(centroidWorld, camera, viewport);

  const dx = vertexScreen.x - centroidScreen.x;
  const dy = vertexScreen.y - centroidScreen.y;
  const len = Math.hypot(dx, dy);
  const dir = len > 1 ? { x: dx / len, y: dy / len } : { x: 0, y: -1 };

  return {
    x: vertexScreen.x + dir.x * VERTEX_DELETE_HANDLE_OFFSET_PX,
    y: vertexScreen.y + dir.y * VERTEX_DELETE_HANDLE_OFFSET_PX,
  };
}

/**
 * Returns true if `screenPoint` is within the hit radius of the "×" handle.
 */
export function hitTestVertexDeleteHandle(
  handleCenter: ScreenPoint,
  screenPoint: ScreenPoint
): boolean {
  const distanceSquared =
    (screenPoint.x - handleCenter.x) ** 2 + (screenPoint.y - handleCenter.y) ** 2;
  return distanceSquared <= VERTEX_DELETE_HANDLE_HIT_RADIUS_PX ** 2;
}

/**
 * Removes `vertexIndex` from the room's polygon while keeping perfect
 * orthogonality. The neighbour that APPROACHES the deleted vertex is shifted
 * to align with the neighbour that DEPARTS it, then collinear points are
 * cleaned up so e.g. an L-shape becomes a rectangle in one operation.
 *
 * Returns null when deletion would produce an invalid polygon, or when the
 * approaching wall is diagonal (45° rooms).
 */
export function getVertexDeletionResult(
  room: Room,
  vertexIndex: number
): { previousPoints: Point[]; nextPoints: Point[] } | null {
  const { points } = room;
  if (points.length <= 4) return null;

  const n = points.length;
  const prevIndex = (vertexIndex - 1 + n) % n;
  const nextIndex = (vertexIndex + 1) % n;

  const prevPoint = points[prevIndex];
  const currPoint = points[vertexIndex];
  const nextPoint = points[nextIndex];

  // Only orthogonal (non-diagonal) walls are supported.
  const prevAxis = getOrthogonalSegmentAxis(prevPoint, currPoint);
  if (!prevAxis) return null;

  // Shift prevPoint so the new direct edge prevPoint→nextPoint is orthogonal.
  const newPrevPoint: Point =
    prevAxis === "horizontal"
      ? { x: prevPoint.x, y: nextPoint.y }
      : { x: nextPoint.x, y: prevPoint.y };

  // Build the candidate point list (without the deleted vertex).
  const rawNext: Point[] = [];
  for (let i = 0; i < n; i++) {
    if (i === vertexIndex) continue;
    rawNext.push(i === prevIndex ? newPrevPoint : { ...points[i] });
  }

  // Collapse any collinear triples that the deletion may have created.
  const cleaned = removeCollinearPoints(rawNext);

  if (cleaned.length < 4) return null;
  if (!isSupportedDrawPointPath(cleaned, { closed: true })) return null;
  if (!isSimplePolygon(cleaned)) return null;

  return {
    previousPoints: points.map((p) => ({ ...p })),
    nextPoints: cleaned,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function removeCollinearPoints(points: Point[]): Point[] {
  // Strip consecutive duplicates.
  const cleaned: Point[] = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    cleaned.push({ ...point });
  }

  // Iteratively remove any middle point that is collinear with its neighbours.
  let changed = true;
  while (changed && cleaned.length > 4) {
    changed = false;
    for (let index = 0; index < cleaned.length; index++) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length];
      const current = cleaned[index];
      const next = cleaned[(index + 1) % cleaned.length];
      const collinear =
        (previous.x === current.x && current.x === next.x) ||
        (previous.y === current.y && current.y === next.y);
      if (!collinear) continue;
      cleaned.splice(index, 1);
      changed = true;
      break;
    }
  }

  return cleaned;
}
