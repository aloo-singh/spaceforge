import type { SharedSelectionItem, Floor, Room, RoomWall } from "@/lib/editor/types";
import { resolveRoomWallSegmentIndex } from "@/lib/editor/openings";

export type BreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

/**
 * Converts a wall value to its display label.
 * Handles both numeric indices and cardinal directions.
 */
export function getWallLabel(room: Room, wall: RoomWall): string {
  if (typeof wall === "number") {
    return `Wall ${wall + 1}`;
  }
  
  // For cardinal directions, resolve to segment index
  const segmentIndex = resolveRoomWallSegmentIndex(room, wall);
  if (segmentIndex !== null) {
    return `Wall ${segmentIndex + 1}`;
  }
  
  return `Wall`;
}

/**
 * Builds a breadcrumb trail from a selection hierarchy.
 * The hierarchy is: Floor > Room > Wall > Opening/Asset
 * 
 * Returns breadcrumb items representing the path to the currently selected item.
 * If selection is empty but activeFloorId is provided, shows just the floor breadcrumb.
 */
export function buildSelectionBreadcrumbs(
  selection: SharedSelectionItem[],
  floors: Floor[],
  rooms: Room[],
  onSelectFloor?: (floorId: string) => void,
  onSelectRoom?: (roomId: string) => void,
  activeFloorId?: string
): BreadcrumbItem[] {
  // If no explicit selection, but we have an active floor, show just the floor
  if (selection.length === 0) {
    if (activeFloorId) {
      const floor = floors.find((f) => f.id === activeFloorId);
      if (floor) {
        return [
          {
            label: floor.name,
            onClick: onSelectFloor ? () => onSelectFloor(activeFloorId) : undefined,
          },
        ];
      }
    }
    return [];
  }

  // We only care about the last selected item for the breadcrumb
  const selectedItem = selection[selection.length - 1];

  const breadcrumbs: BreadcrumbItem[] = [];

  // Helper to find floor and room
  let floorId: string | null = null;
  let roomId: string | null = null;

  // Determine the floor and room IDs based on selection type
  if (selectedItem.type === "floor") {
    floorId = selectedItem.id;
  } else if (selectedItem.type === "room") {
    roomId = selectedItem.id;
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      floorId = room.floorId;
    }
  } else if (selectedItem.type === "wall") {
    roomId = selectedItem.roomId;
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      floorId = room.floorId;
    }
  } else if (selectedItem.type === "opening") {
    roomId = selectedItem.roomId;
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      floorId = room.floorId;
    }
  } else if (selectedItem.type === "asset") {
    roomId = selectedItem.roomId;
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      floorId = room.floorId;
    }
  }

  // Add floor breadcrumb if available
  if (floorId) {
    const floor = floors.find((f) => f.id === floorId);
    if (floor) {
      breadcrumbs.push({
        label: floor.name,
        onClick: onSelectFloor ? () => onSelectFloor(floorId!) : undefined,
      });
    }
  }

  // Add room breadcrumb if available
  if (roomId) {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      breadcrumbs.push({
        label: room.name,
        onClick: onSelectRoom ? () => onSelectRoom(roomId!) : undefined,
      });
    }
  }

  // Add the selected item's specific identifier
  if (selectedItem.type === "wall") {
    const room = rooms.find((r) => r.id === selectedItem.roomId);
    if (room) {
      breadcrumbs.push({
        label: getWallLabel(room, selectedItem.wall as RoomWall),
      });
    }
  } else if (selectedItem.type === "opening") {
    const room = rooms.find((r) => r.id === selectedItem.roomId);
    if (room) {
      const opening = room.openings.find((o) => o.id === selectedItem.openingId);
      if (opening) {
        // Add wall breadcrumb
        breadcrumbs.push({
          label: getWallLabel(room, opening.wall as RoomWall),
        });
        // Add opening label
        const label = opening.type === "door" ? "Door" : "Window";
        breadcrumbs.push({
          label: label,
        });
      }
    }
  } else if (selectedItem.type === "asset") {
    const room = rooms.find((r) => r.id === selectedItem.roomId);
    if (room) {
      const asset = room.interiorAssets.find((a) => a.id === selectedItem.id);
      breadcrumbs.push({
        label: asset?.name || "Stairs",
      });
    }
  }

  return breadcrumbs;
}
