"use client";

import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { UnitOriginTag } from "@/components/editor/UnitOriginTag";
import { formatWallDimension } from "@/lib/editor/measurements";
import type { Room, RoomWall, Wall } from "@/lib/editor/types";
import { getRoomWallSegment } from "@/lib/editor/openings";
import { getWallLabel } from "@/lib/editor/breadcrumbs";
import { useEditorStore } from "@/stores/editorStore";

type SelectedWallInspectorProps = {
  room: Room;
  wall: RoomWall;
  className?: string;
};

function formatWallType(type: Wall["type"]) {
  switch (type) {
    case "external":
      return "External";
    case "internal":
      return "Internal";
    case "user":
      return "User";
  }
}

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
  const selectedWallObject = room.walls?.[wallSegment.segmentIndex] ?? null;
  
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

        {selectedWallObject ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Wall object</p>
              <UnitOriginTag unitOrigin={selectedWallObject.unitOrigin} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatWallType(selectedWallObject.type)}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Thickness</p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {formatWallDimension(selectedWallObject.thicknessMm, displayUnitOrigin)}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Floor height</p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {formatWallDimension(selectedWallObject.floorHeightMm, displayUnitOrigin)}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Ceiling height</p>
                <p className="mt-1 font-mono text-sm text-foreground">
                  {formatWallDimension(selectedWallObject.ceilingHeightMm, displayUnitOrigin)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

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
