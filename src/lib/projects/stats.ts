import type { EditorDocumentState } from "@/lib/editor/history";
import { getRoomAreaSquareMillimetres } from "@/lib/editor/measurements";

export type ProjectListStats = {
  roomCount: number;
  floorCount: number;
  totalAreaSquareMillimetres: number;
};

export function getProjectListStats(document: EditorDocumentState): ProjectListStats {
  return {
    roomCount: document.rooms.length,
    floorCount: Math.max(1, document.floors.length),
    totalAreaSquareMillimetres: document.rooms.reduce(
      (totalArea, room) => totalArea + getRoomAreaSquareMillimetres(room),
      0
    ),
  };
}
