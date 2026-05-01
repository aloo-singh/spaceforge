"use client";

import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
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
  activeFloorId?: string;
  className?: string;
};

export function InspectorBreadcrumbHeader({
  selection,
  floors,
  rooms,
  onSelectFloor,
  onSelectRoom,
  activeFloorId,
  className,
}: InspectorBreadcrumbHeaderProps) {
  const breadcrumbs = buildSelectionBreadcrumbs(
    selection,
    floors,
    rooms,
    onSelectFloor,
    onSelectRoom,
    activeFloorId
  );

  if (breadcrumbs.length === 0) {
    return null;
  }

  // Show ellipsis after first item if we have more than 3 items
  const showEllipsis = breadcrumbs.length > 3;
  const itemsToShow = showEllipsis ? [breadcrumbs[0], ...breadcrumbs.slice(-2)] : breadcrumbs;

  return (
    <div className={cn("flex items-center min-w-0", className)}>
      <Breadcrumb>
        <BreadcrumbList className="text-xs gap-1">
          {breadcrumbs[0] && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={breadcrumbs[0].onClick}
                  className={breadcrumbs[0].onClick ? "cursor-pointer" : ""}
                >
                  {breadcrumbs[0].label}
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.length > 1 && <BreadcrumbSeparator />}
            </>
          )}

          {showEllipsis && (
            <>
              <BreadcrumbItem>
                <BreadcrumbEllipsis />
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}

          {showEllipsis
            ? breadcrumbs.slice(-2).map((item, index) => {
                const isLast = index === 1;
                const originalIndex = breadcrumbs.length - (2 - index);
                return (
                  <React.Fragment key={originalIndex}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="font-medium text-foreground">
                          {item.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          onClick={item.onClick}
                          className={item.onClick ? "cursor-pointer" : ""}
                        >
                          {item.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })
            : breadcrumbs.slice(1).map((item, index) => {
                const isLast = index === breadcrumbs.length - 2;
                return (
                  <React.Fragment key={index + 1}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="font-medium text-foreground">
                          {item.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          onClick={item.onClick}
                          className={item.onClick ? "cursor-pointer" : ""}
                        >
                          {item.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
