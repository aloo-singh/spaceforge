"use client";

import { useCallback, useState, useLayoutEffect } from "react";
import { Plus, BedFilled, Sofa, Hanger, ToolsKitchen2Filled } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMobile } from "@/lib/use-mobile";
import { cn } from "@/lib/utils";
import type { InteriorAssetType } from "@/lib/editor/types";

/**
 * Asset category for organizing furniture in the UI.
 */
interface AssetCategory {
  name: string;
  items: AssetItem[];
}

/**
 * Individual asset that can be placed.
 */
interface AssetItem {
  type: InteriorAssetType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const ASSET_CATEGORIES: AssetCategory[] = [
  {
    name: "Furniture",
    items: [
      {
        type: "bed",
        label: "Bed",
        description: "Place a bed",
        icon: <BedFilled className="size-5" />,
      },
      {
        type: "sofa",
        label: "Sofa",
        description: "Place a sofa",
        icon: <Sofa className="size-5" />,
      },
      {
        type: "wardrobe",
        label: "Wardrobe",
        description: "Place a wardrobe",
        icon: <Hanger className="size-5" />,
      },
      {
        type: "dining-table",
        label: "Table",
        description: "Place a table",
        icon: <ToolsKitchen2Filled className="size-5" />,
      },
    ],
  },
];

interface AssetsPanelProps {
  onPlaceAsset: (assetType: InteriorAssetType) => void;
  isDisabled?: boolean;
  disabledReason?: string;
}

/**
 * Assets panel that allows users to place furniture in the selected room.
 * Conditionally renders as a drawer on mobile or popover on desktop.
 */
export function AssetsPanel({
  onPlaceAsset,
  isDisabled = false,
  disabledReason = "Select a room to add furniture",
}: AssetsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isMobile, isReady } = useMobile();
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleAssetClick = useCallback(
    (assetType: InteriorAssetType) => {
      onPlaceAsset(assetType);
      setIsOpen(false);
    },
    [onPlaceAsset]
  );

  const assetButton = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={isDisabled}
      aria-label="Add furniture"
      title={isDisabled ? disabledReason : "Add furniture"}
      className="size-9 sm:size-8 [@media(max-height:540px)_and_(orientation:landscape)]:size-8"
      suppressHydrationWarning
    >
      <Plus className="size-4" />
    </Button>
  );

  const desktopContent = (
    <div className="flex flex-col gap-2 p-3">
      <h3 className="text-sm font-semibold">Add Furniture</h3>
      {ASSET_CATEGORIES.map((category) => (
        <div key={category.name} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category.name}
          </h4>
          <div className="flex flex-col gap-1">
            {category.items.map((item) => (
              <button
                key={item.type}
                onClick={() => handleAssetClick(item.type)}
                disabled={isDisabled}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                )}
              >
                <div className="text-muted-foreground">{item.icon}</div>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const mobileContent = (
    <div className="flex flex-col gap-4 p-4">
      {ASSET_CATEGORIES.map((category) => (
        <div key={category.name} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category.name}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {category.items.map((item) => (
              <button
                key={item.type}
                onClick={() => handleAssetClick(item.type)}
                disabled={isDisabled}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border border-border/50 p-3 transition-all hover:border-border hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <div className="text-muted-foreground">{item.icon}</div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // Before hydration, show popover (safe default)
  // After hydration, show based on actual viewport
  const shouldShowDrawer = mounted && isReady && isMobile;

  if (shouldShowDrawer) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>{assetButton}</DrawerTrigger>
        <DrawerContent className="flex flex-col gap-2">
          <DrawerTitle className="px-4 py-2">Add Furniture</DrawerTitle>
          <div className="mx-auto w-12 rounded-full bg-muted p-1.5">
            <div className="flex h-1 w-full rounded-full bg-muted-foreground" />
          </div>
          {mobileContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{assetButton}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0" side="bottom">
        {desktopContent}
      </PopoverContent>
    </Popover>
  );
}
