"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { SharedSelectionItem, Floor, Room } from "@/lib/editor/types";
import { buildSelectionBreadcrumbs } from "@/lib/editor/breadcrumbs";
import { cn } from "@/lib/utils";

type InspectorBreadcrumbHeaderProps = {
  selection: SharedSelectionItem[];
  floors: Floor[];
  rooms: Room[];
  onSelectFloor?: (floorId: string) => void;
  onSelectRoom?: (roomId: string) => void;
  className?: string;
};

export function InspectorBreadcrumbHeader({
  selection,
  floors,
  rooms,
  onSelectFloor,
  onSelectRoom,
  className,
}: InspectorBreadcrumbHeaderProps) {
  const breadcrumbs = buildSelectionBreadcrumbs(
    selection,
    floors,
    rooms,
    onSelectFloor,
    onSelectRoom
  );

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <div className={cn("absolute top-2 left-12 z-10 flex items-center", className)}>
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <div key={index} className="flex items-center gap-1.5">
                {isLast ? (
                  <BreadcrumbPage className="font-medium text-foreground">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <>
                    <BreadcrumbLink
                      onClick={item.onClick}
                      className={item.onClick ? "cursor-pointer" : ""}
                    >
                      {item.label}
                    </BreadcrumbLink>
                    <BreadcrumbSeparator />
                  </>
                )}
              </div>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
