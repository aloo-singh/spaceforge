import type { EditorDocumentState } from "@/lib/editor/history";
import { getRoomAreaSquareMillimetres } from "@/lib/editor/measurements";
import { normalizeProjectRegion, type ProjectRegion } from "@/lib/projects/region";

export type ProjectListStats = {
  region: ProjectRegion;
  roomCount: number;
  floorCount: number;
  totalAreaSquareMillimetres: number;
};

export function getProjectListStats(document: EditorDocumentState): ProjectListStats {
  return {
    region: normalizeProjectRegion(document.region),
    roomCount: document.rooms.length,
    floorCount: Math.max(1, document.floors.length),
    totalAreaSquareMillimetres: document.rooms.reduce(
      (totalArea, room) => totalArea + getRoomAreaSquareMillimetres(room),
      0
    ),
  };
}
