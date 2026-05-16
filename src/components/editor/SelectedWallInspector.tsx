"use client";

import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { UnitOriginTag } from "@/components/editor/UnitOriginTag";
import { formatWallDimension } from "@/lib/editor/measurements";
import type { Room, RoomWall } from "@/lib/editor/types";
import { getRoomWallSegment } from "@/lib/editor/openings";
import { getWallLabel } from "@/lib/editor/breadcrumbs";
import { useEditorStore } from "@/stores/editorStore";

type SelectedWallInspectorProps = {
  room: Room;
  wall: RoomWall;
  className?: string;
};

export function SelectedWallInspector({
  room,
  wall,
  className,
}: SelectedWallInspectorProps) {
  const wallSegment = getRoomWallSegment(room, wall);
  const displayUnitOrigin = useEditorStore((state) => state.document.region);
  
  if (!wallSegment) {
    return null;
  }

  const wallName = getWallLabel(room, wall);
  
  // Count doors and windows on this wall
  const doorsAndWindows = room.openings.filter((opening) => opening.wall === wall);
  const doorCount = doorsAndWindows.filter((o) => o.type === "door").length;
  const windowCount = doorsAndWindows.filter((o) => o.type === "window").length;

  return (
    <EditorInspectorSection 
      title="SELECTED WALL"
      description="View wall details and openings."
      className={className}
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
            Wall
          </label>
          <p className="mt-2 text-sm font-medium text-foreground">{wallName}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Dimensions</p>
            <UnitOriginTag unitOrigin={wallSegment.unitOrigin} />
          </div>
          <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground">
            {formatWallDimension(wallSegment.lengthMm, displayUnitOrigin)}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
            Openings
          </label>
          <div className="mt-2 flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Doors</p>
              <p className="text-lg font-semibold text-foreground">{doorCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Windows</p>
              <p className="text-lg font-semibold text-foreground">{windowCount}</p>
            </div>
          </div>
        </div>
      </div>
    </EditorInspectorSection>
  );
}
