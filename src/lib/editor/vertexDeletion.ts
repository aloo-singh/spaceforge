import { worldToScreen } from "@/lib/editor/camera";
import { getOrthogonalSegmentAxis } from "@/lib/editor/geometry";
import { isSimplePolygon } from "@/lib/editor/roomGeometry";
import { isSupportedDrawPointPath } from "@/lib/editor/snapping";
import type { CameraState, Point, Room, ScreenPoint, ViewportSize } from "@/lib/editor/types";

// The wall-split handle is offset 20px orthogonally (one axis only).
// The vertex-delete handle is offset diagonally, so to match the same per-axis
// distance (20px in X and 20px in Y) the diagonal magnitude must be 20 * √2 ≈ 28px.
export const VERTEX_DELETE_HANDLE_OFFSET_PX = Math.round(20 * Math.SQRT2);
const VERTEX_DELETE_HANDLE_HIT_RADIUS_PX = 16;

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

  const n = room.points.length;
  const vertexWorld = room.points[vertexIndex];
  const prevWorld = room.points[(vertexIndex - 1 + n) % n];
  const nextWorld = room.points[(vertexIndex + 1) % n];

  const vertexScreen = worldToScreen(vertexWorld, camera, viewport);

  // Compute the outward diagonal bisector in screen space so it is automatically
  // correct for any camera rotation and any room aspect ratio.
  //
  // Strategy: average the right-hand normals of the two wall segments meeting at
  // this vertex.  For an orthogonal corner the two walls are perpendicular, so
  // the right-hand normals are also perpendicular and their average is exactly
  // the 45° diagonal bisector.  The right-hand normal of direction (dx, dy) is
  // (dy, -dx) – it points LEFT of travel for a CW polygon and RIGHT for CCW.
  // We then use the centroid-to-vertex direction as a sign oracle to ensure we
  // always end up on the *outward* side of the room regardless of winding order.

  const prevScreen = worldToScreen(prevWorld, camera, viewport);
  const nextScreen = worldToScreen(nextWorld, camera, viewport);

  const d_inX = vertexScreen.x - prevScreen.x;
  const d_inY = vertexScreen.y - prevScreen.y;
  const d_inLen = Math.hypot(d_inX, d_inY);

  const d_outX = nextScreen.x - vertexScreen.x;
  const d_outY = nextScreen.y - vertexScreen.y;
  const d_outLen = Math.hypot(d_outX, d_outY);

  // Centroid direction (always outward from room interior) used for sign correction.
  const centroidWorld = room.points.reduce(
    (acc, p) => ({
      x: acc.x + p.x / n,
      y: acc.y + p.y / n,
    }),
    { x: 0, y: 0 }
  );
  const centroidScreen = worldToScreen(centroidWorld, camera, viewport);
  const cDx = vertexScreen.x - centroidScreen.x;
  const cDy = vertexScreen.y - centroidScreen.y;
  const cLen = Math.hypot(cDx, cDy);

  let dir: { x: number; y: number };

  if (d_inLen > 0.5 && d_outLen > 0.5) {
    // Right-hand normals of incoming and outgoing edges.
    const rhn_inX = d_inY / d_inLen;
    const rhn_inY = -d_inX / d_inLen;
    const rhn_outX = d_outY / d_outLen;
    const rhn_outY = -d_outX / d_outLen;

    const bisX = rhn_inX + rhn_outX;
    const bisY = rhn_inY + rhn_outY;
    const bisLen = Math.hypot(bisX, bisY);

    if (bisLen > 0.01) {
      const ux = bisX / bisLen;
      const uy = bisY / bisLen;
      // Flip if the bisector happens to point inward (concave corner with opposite winding).
      const dot = ux * cDx + uy * cDy;
      dir = dot >= 0 ? { x: ux, y: uy } : { x: -ux, y: -uy };
    } else {
      // Collinear walls (0° or 180° corner) – fall back to centroid direction.
      dir = cLen > 1 ? { x: cDx / cLen, y: cDy / cLen } : { x: 0, y: -1 };
    }
  } else {
    // Degenerate edge lengths – fall back to centroid direction.
    dir = cLen > 1 ? { x: cDx / cLen, y: cDy / cLen } : { x: 0, y: -1 };
  }

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
