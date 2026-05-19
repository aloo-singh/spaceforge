"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BorderAll,
  Download,
  IconBath,
  IconDroplet,
  IconFlame,
  IconFountain,
  IconFridge,
  IconLamp2,
  IconMicrowave,
  IconToiletPaper,
  IconWash,
  Stars,
  World,
} from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImmediateTooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePrefersReducedMotion } from "@/lib/accessibility/use-prefers-reduced-motion";
import { getInteriorAssetDisplayName } from "@/lib/editor/interiorAssets";
import {
  EDITOR_EXPORT_SIGNATURE_MAX_LENGTH,
  normalizeEditorExportSignature,
  shouldShowDimensions,
} from "@/lib/editor/settings";
import type { InteriorAssetType } from "@/lib/editor/types";
import { saveGlobalSettings } from "@/lib/editor/globalSettings";
import { normalizeProjectRegion, type ProjectRegion } from "@/lib/projects/region";
import { getFeatureConfig } from "@/lib/subscription/features";
import { getTierConfig } from "@/lib/subscription/tiers";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";

type EditorSettingsDialogProps = {
  contentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type SettingsTab = "appearance" | "canvas" | "regional" | "export";

type RegionalAssetDefault = {
  type: InteriorAssetType;
  icon: ReactNode;
  metricSize: string;
  imperialSize: string;
};

const REGIONAL_ASSET_DEFAULTS: RegionalAssetDefault[] = [
  {
    type: "kitchen-unit",
    icon: <IconFridge className="size-4" />,
    metricSize: "600 x 600 mm",
    imperialSize: "24 x 24 in",
  },
  {
    type: "kitchen-appliance",
    icon: <IconMicrowave className="size-4" />,
    metricSize: "600 x 600 mm",
    imperialSize: "30 x 30 in",
  },
  {
    type: "hob",
    icon: <IconFlame className="size-4" />,
    metricSize: "600 x 600 mm",
    imperialSize: "30 x 24 in",
  },
  {
    type: "sink",
    icon: <IconWash className="size-4" />,
    metricSize: "1200 x 600 mm",
    imperialSize: "33 x 22 in",
  },
  {
    type: "toilet",
    icon: <IconToiletPaper className="size-4" />,
    metricSize: "400 x 700 mm",
    imperialSize: "15 x 28 in",
  },
  {
    type: "shower",
    icon: <IconFountain className="size-4 rotate-180" />,
    metricSize: "800 x 800 mm",
    imperialSize: "36 x 36 in",
  },
  {
    type: "bath",
    icon: <IconBath className="size-4" />,
    metricSize: "700 x 1600 mm",
    imperialSize: "30 x 60 in",
  },
  {
    type: "basin",
    icon: <IconDroplet className="size-4" />,
    metricSize: "500 x 400 mm",
    imperialSize: "20 x 16 in",
  },
  {
    type: "desk",
    icon: <IconLamp2 className="size-4" />,
    metricSize: "1200 x 900 mm",
    imperialSize: "48 x 30 in",
  },
];

export function EditorSettingsDialog({
  contentId,
  open,
  onOpenChange,
}: EditorSettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [measuredContentHeight, setMeasuredContentHeight] = useState<number | null>(null);
  const tabPanelRef = useRef<HTMLDivElement | null>(null);
  const settings = useEditorStore((state) => state.settings);
  const projectRegion = useEditorStore((state) => normalizeProjectRegion(state.document.region));
  const updateSettings = useEditorStore((state) => state.updateSettings);
  const updateProjectRegion = useEditorStore((state) => state.updateProjectRegion);
  const devSubscriptionTier = useEditorStore((state) => state.devSubscriptionTier);
  const keyboardShortcutFeedbackEnabled = useEditorStore(
    (state) => state.keyboardShortcutFeedbackEnabled
  );
  const setKeyboardShortcutFeedbackEnabled = useEditorStore(
    (state) => state.setKeyboardShortcutFeedbackEnabled
  );
  const dimensionsVisible = shouldShowDimensions(settings);
  const isLargeMeasurementText = settings.measurementFontSize === "large";
  const isWallMeasurementInside = settings.wallMeasurementPosition === "inside";
  const isCanvasHudVisible = settings.showCanvasHud;
  const isMiniMapVisible = settings.showMiniMap;
  const areRoomNamesVisible = settings.showRoomNames;
  const areRoomColorsVisible = settings.showRoomColors;
  const areAssetsVisible = settings.showAssets;
  const areAssetLabelsVisible = settings.showAssetLabels;
  const areGuidelinesVisible = settings.showGuidelines;
  const isSnappingEnabled = settings.snappingEnabled;
  const isFloorFootprintVisible = settings.showFloorFootprint;
  const floorFootprintOpacity = settings.floorFootprintOpacity;
  const isCompactSidebarDensity = settings.sidebarDensity === "compact";
  const normalizedExportSignature = normalizeEditorExportSignature(settings.exportSignatureText);
  const selectedAppearance = theme === "light" || theme === "dark" ? theme : "system";
  const areUnitOriginHighlightsVisible = settings.showUnitOriginHighlights;
  const canShowUnitOriginHighlights = getTierConfig(devSubscriptionTier).hasUnitOriginHighlight;
  const unitOriginHighlightsActive =
    canShowUnitOriginHighlights && areUnitOriginHighlightsVisible;
  const unitOriginHighlightFeature = getFeatureConfig(devSubscriptionTier, "unitOriginHighlight");
  const unitOriginHighlightTooltip = canShowUnitOriginHighlights
    ? "Highlight metric-origin elements yellow and imperial-origin elements magenta"
    : unitOriginHighlightFeature?.upsellMessage("Pro", 1) ??
      "Upgrade to Pro to highlight metric and imperial-origin elements";
  const regionOptions: Array<{ value: ProjectRegion; label: string }> = [
    { value: "metric", label: "Metric" },
    { value: "imperial", label: "Imperial" },
  ];
  const tabContentClassName = cn(
    "mt-0",
    !prefersReducedMotion &&
      "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-150"
  );

  useLayoutEffect(() => {
    if (prefersReducedMotion || !open) return;

    const panel = tabPanelRef.current;
    if (!panel) return;

    const updateContentHeight = () => {
      setMeasuredContentHeight(panel.getBoundingClientRect().height);
    };

    const frame = requestAnimationFrame(updateContentHeight);

    const resizeObserver = new ResizeObserver(updateContentHeight);
    resizeObserver.observe(panel);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [activeTab, open, prefersReducedMotion]);

  return (
    <ResponsiveDialog
      contentId={contentId}
      open={open}
      onOpenChange={onOpenChange}
      title="Editor settings"
      description="A focused home for editor preferences."
      className="sm:w-[min(100%,56rem)] sm:p-5"
      footer={
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="w-full sm:w-auto"
        >
          Close
        </Button>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SettingsTab)}
        className="gap-4"
      >
        <TabsList className="!grid h-auto !w-full grid-cols-2 sm:h-9 sm:grid-cols-4">
          <TabsTrigger value="appearance">
            <Stars className="size-4" aria-hidden="true" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="canvas">
            <BorderAll className="size-4" aria-hidden="true" />
            Canvas
          </TabsTrigger>
          <TabsTrigger value="regional">
            <World className="size-4" aria-hidden="true" />
            Regional
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="size-4" aria-hidden="true" />
            Export
          </TabsTrigger>
        </TabsList>

        <div
          className={cn(
            "overflow-hidden",
            !prefersReducedMotion && "transition-[height] duration-200 ease-out"
          )}
          style={
            !prefersReducedMotion && measuredContentHeight !== null
              ? { height: measuredContentHeight }
              : undefined
          }
        >
          <div
            ref={tabPanelRef}
            className={cn(
              !prefersReducedMotion && "transition-opacity duration-150 ease-out"
            )}
          >
        <TabsContent value="appearance" className={tabContentClassName}>
          <section className="grid gap-3 lg:grid-cols-2">
        <div
          aria-labelledby="editor-settings-appearance-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-appearance-title" className="text-sm font-medium text-foreground">
                Appearance
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Choose how the editor and app shell should look.
              </p>
            </div>
          </div>

          <div
            className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-border/70 bg-background/90 p-1"
            role="group"
            aria-label="Appearance mode"
          >
            <Button
              type="button"
              size="sm"
              variant={selectedAppearance === "system" ? "secondary" : "ghost"}
              aria-pressed={selectedAppearance === "system"}
              onClick={() => setTheme("system")}
            >
              System
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedAppearance === "light" ? "secondary" : "ghost"}
              aria-pressed={selectedAppearance === "light"}
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedAppearance === "dark" ? "secondary" : "ghost"}
              aria-pressed={selectedAppearance === "dark"}
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-sidebar-density-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-sidebar-density-title" className="text-sm font-medium text-foreground">
                Sidebar density
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Choose between a spacious tree and a compact, higher-density layout.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Sidebar density"
          >
            <Button
              type="button"
              size="sm"
              variant={!isCompactSidebarDensity ? "secondary" : "ghost"}
              aria-pressed={!isCompactSidebarDensity}
              onClick={() => {
                updateSettings({ sidebarDensity: "comfortable" });
                saveGlobalSettings({ sidebarDensity: "comfortable" });
              }}
              className="min-w-28 flex-1 sm:flex-none"
            >
              Comfortable
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isCompactSidebarDensity ? "secondary" : "ghost"}
              aria-pressed={isCompactSidebarDensity}
              onClick={() => {
                updateSettings({ sidebarDensity: "compact" });
                saveGlobalSettings({ sidebarDensity: "compact" });
              }}
              className="min-w-24 flex-1 sm:flex-none"
            >
              Compact
            </Button>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-keyboard-shortcut-feedback-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3
                id="editor-settings-keyboard-shortcut-feedback-title"
                className="text-sm font-medium text-foreground"
              >
                Keyboard shortcut feedback
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Show brief confirmation toasts for editor shortcuts like HUD, guidelines, and
                snapping.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Keyboard shortcut feedback"
          >
            <Button
              type="button"
              size="sm"
              variant={keyboardShortcutFeedbackEnabled ? "secondary" : "ghost"}
              aria-pressed={keyboardShortcutFeedbackEnabled}
              onClick={() => setKeyboardShortcutFeedbackEnabled(true)}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!keyboardShortcutFeedbackEnabled ? "secondary" : "ghost"}
              aria-pressed={!keyboardShortcutFeedbackEnabled}
              onClick={() => setKeyboardShortcutFeedbackEnabled(false)}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Applies only to this session and resets when the editor is reopened.
          </p>
        </div>
          </section>
        </TabsContent>

        <TabsContent value="canvas" className={tabContentClassName}>
          <section className="grid gap-3 lg:grid-cols-2">

        <div
          aria-labelledby="editor-settings-measurements-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-1"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-measurements-title" className="text-sm font-medium text-foreground">
                Dimensions
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Show or hide room area and live dimension overlays while keeping the editor calm.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Dimensions visibility"
          >
            <Button
              type="button"
              size="sm"
              variant={dimensionsVisible ? "secondary" : "ghost"}
              aria-pressed={dimensionsVisible}
              onClick={() => updateSettings({ dimensionsVisibility: "visible" })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Show
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!dimensionsVisible ? "secondary" : "ghost"}
              aria-pressed={!dimensionsVisible}
              onClick={() => updateSettings({ dimensionsVisibility: "hidden" })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Hide
            </Button>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Hold Alt/Option to temporarily invert this while drawing or resizing.
          </p>

          <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
            <div>
              <h4 className="text-xs font-medium text-foreground">Wall measurement position</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Place selected-room wall measurements just inside the walls or offset them outside.
              </p>
            </div>

            <div
              className="flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
              role="radiogroup"
              aria-label="Wall measurement position"
            >
              <Button
                type="button"
                size="sm"
                role="radio"
                variant={isWallMeasurementInside ? "secondary" : "ghost"}
                aria-checked={isWallMeasurementInside}
                onClick={() => updateSettings({ wallMeasurementPosition: "inside" })}
                className="min-w-28 flex-1 sm:flex-none"
              >
                Inside walls
              </Button>
              <Button
                type="button"
                size="sm"
                role="radio"
                variant={!isWallMeasurementInside ? "secondary" : "ghost"}
                aria-checked={!isWallMeasurementInside}
                onClick={() => updateSettings({ wallMeasurementPosition: "outside" })}
                className="min-w-28 flex-1 sm:flex-none"
              >
                Outside walls
              </Button>
            </div>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-measurement-font-size-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3
                id="editor-settings-measurement-font-size-title"
                className="text-sm font-medium text-foreground"
              >
                Measurement text size
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Increase room area and live dimension text for readability without changing the
                broader editor typography.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Measurement text size"
          >
            <Button
              type="button"
              size="sm"
              variant={!isLargeMeasurementText ? "secondary" : "ghost"}
              aria-pressed={!isLargeMeasurementText}
              onClick={() => updateSettings({ measurementFontSize: "normal" })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Normal
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isLargeMeasurementText ? "secondary" : "ghost"}
              aria-pressed={isLargeMeasurementText}
              onClick={() => updateSettings({ measurementFontSize: "large" })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Large
            </Button>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Applies to room area beneath the label pill and live draw or resize dimensions on both
            desktop and mobile settings surfaces.
          </p>
        </div>

        <div
          aria-labelledby="editor-settings-canvas-hud-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 id="editor-settings-canvas-hud-title" className="text-sm font-medium text-foreground">
                  Show canvas HUD
                </h3>
                <Kbd aria-hidden="true">
                  H
                </Kbd>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Keep the scale and north instruments visible on the canvas as a calm orientation aid.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Show canvas HUD"
          >
            <Button
              type="button"
              size="sm"
              variant={isCanvasHudVisible ? "secondary" : "ghost"}
              aria-pressed={isCanvasHudVisible}
              onClick={() => updateSettings({ showCanvasHud: true })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!isCanvasHudVisible ? "secondary" : "ghost"}
              aria-pressed={!isCanvasHudVisible}
              onClick={() => updateSettings({ showCanvasHud: false })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-mini-map-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-6"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-mini-map-title" className="text-sm font-medium text-foreground">
                Show mini-map
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Keep the overview map visible in the canvas corner for quick spatial navigation.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Show mini-map"
          >
            <Button
              type="button"
              size="sm"
              variant={isMiniMapVisible ? "secondary" : "ghost"}
              aria-pressed={isMiniMapVisible}
              onClick={() => updateSettings({ showMiniMap: true })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!isMiniMapVisible ? "secondary" : "ghost"}
              aria-pressed={!isMiniMapVisible}
              onClick={() => updateSettings({ showMiniMap: false })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-room-names-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-7"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-room-names-title" className="text-sm font-medium text-foreground">
                Show room names
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Display room labels in the canvas for quick spatial identification.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Show room names"
          >
            <Button
              type="button"
              size="sm"
              variant={areRoomNamesVisible ? "secondary" : "ghost"}
              aria-pressed={areRoomNamesVisible}
              onClick={() => updateSettings({ showRoomNames: true })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!areRoomNamesVisible ? "secondary" : "ghost"}
              aria-pressed={!areRoomNamesVisible}
              onClick={() => updateSettings({ showRoomNames: false })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-room-colors-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-8"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-room-colors-title" className="text-sm font-medium text-foreground">
                Show room colours
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Use assigned room colours for canvas fills, or keep the default floorplan fill.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Show room colours"
          >
            <Button
              type="button"
              size="sm"
              variant={areRoomColorsVisible ? "secondary" : "ghost"}
              aria-pressed={areRoomColorsVisible}
              onClick={() => updateSettings({ showRoomColors: true })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!areRoomColorsVisible ? "secondary" : "ghost"}
              aria-pressed={!areRoomColorsVisible}
              onClick={() => updateSettings({ showRoomColors: false })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-assets-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-assets-title" className="text-sm font-medium text-foreground">
                Show assets
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Display furniture and fixtures on the canvas, or hide them for a clean floorplan view.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Show assets"
          >
            <Button
              type="button"
              size="sm"
              variant={areAssetsVisible ? "secondary" : "ghost"}
              aria-pressed={areAssetsVisible}
              onClick={() => updateSettings({ showAssets: true })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!areAssetsVisible ? "secondary" : "ghost"}
              aria-pressed={!areAssetsVisible}
              onClick={() => updateSettings({ showAssets: false })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>

          <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
            <div>
              <h4 className="text-xs font-medium text-foreground">Show asset labels</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Display labels on furniture and fixtures for quick item identification.
              </p>
            </div>

            <div
              className="flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
              role="group"
              aria-label="Show asset labels"
            >
              <Button
                type="button"
                size="sm"
                variant={areAssetLabelsVisible ? "secondary" : "ghost"}
                aria-pressed={areAssetLabelsVisible}
                disabled={!areAssetsVisible}
                onClick={() => updateSettings({ showAssetLabels: true })}
                className="min-w-20 flex-1 sm:flex-none disabled:cursor-not-allowed"
              >
                On
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!areAssetLabelsVisible ? "secondary" : "ghost"}
                aria-pressed={!areAssetLabelsVisible}
                disabled={!areAssetsVisible}
                onClick={() => updateSettings({ showAssetLabels: false })}
                className="min-w-20 flex-1 sm:flex-none disabled:cursor-not-allowed"
              >
                Off
              </Button>
            </div>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-guidelines-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-8"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 id="editor-settings-guidelines-title" className="text-sm font-medium text-foreground">
                  Show guidelines
                </h3>
                <Kbd aria-hidden="true">
                  G
                </Kbd>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Show predictive muted guides from nearby room edges while moving, drawing, and resizing.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Show guidelines"
          >
            <Button
              type="button"
              size="sm"
              variant={areGuidelinesVisible ? "secondary" : "ghost"}
              aria-pressed={areGuidelinesVisible}
              onClick={() => updateSettings({ showGuidelines: true })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!areGuidelinesVisible ? "secondary" : "ghost"}
              aria-pressed={!areGuidelinesVisible}
              onClick={() => updateSettings({ showGuidelines: false })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-snapping-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-9"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 id="editor-settings-snapping-title" className="text-sm font-medium text-foreground">
                  Enable snapping
                </h3>
                <Kbd aria-hidden="true">
                  S
                </Kbd>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Magnetically snap active edits to the current grid and nearby predictive guides.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Enable snapping"
          >
            <Button
              type="button"
              size="sm"
              variant={isSnappingEnabled ? "secondary" : "ghost"}
              aria-pressed={isSnappingEnabled}
              onClick={() => updateSettings({ snappingEnabled: true })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!isSnappingEnabled ? "secondary" : "ghost"}
              aria-pressed={!isSnappingEnabled}
              onClick={() => updateSettings({ snappingEnabled: false })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-floor-footprint-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5 lg:order-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-floor-footprint-title" className="text-sm font-medium text-foreground">
                Show floor below footprint
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Display a faint outline of the floor below when viewing a multi-floor layout.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Show floor below footprint"
          >
            <Button
              type="button"
              size="sm"
              variant={isFloorFootprintVisible ? "secondary" : "ghost"}
              aria-pressed={isFloorFootprintVisible}
              onClick={() => updateSettings({ showFloorFootprint: true })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              On
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!isFloorFootprintVisible ? "secondary" : "ghost"}
              aria-pressed={!isFloorFootprintVisible}
              onClick={() => updateSettings({ showFloorFootprint: false })}
              className="min-w-20 flex-1 sm:flex-none"
            >
              Off
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <label htmlFor="floor-footprint-opacity" className="flex items-center justify-between text-xs font-medium text-foreground">
              <span>Opacity</span>
              <span className="text-muted-foreground">{Math.round(floorFootprintOpacity * 100)}%</span>
            </label>
            <Slider
              id="floor-footprint-opacity"
              min={0}
              max={1}
              step={0.05}
              value={[floorFootprintOpacity]}
              disabled={!isFloorFootprintVisible}
              onValueChange={(value) => updateSettings({ floorFootprintOpacity: value[0] })}
              className="w-full data-disabled:cursor-not-allowed"
            />
          </div>
        </div>

          </section>
        </TabsContent>

        <TabsContent value="regional" className={tabContentClassName}>
          <section className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
            <div className="space-y-3">
              <div
                aria-labelledby="editor-settings-regionalisation-title"
                className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div>
                    <h3 id="editor-settings-regionalisation-title" className="text-sm font-medium text-foreground">
                      Project region
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Pick the measurement language for new rooms, openings, rulers, and assets in this project.
                    </p>
                  </div>
                  <span className="w-fit shrink-0 rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Defaults
                  </span>
                </div>

                <ImmediateTooltipProvider>
                  <div
                    className="mt-4 grid w-full grid-cols-2 rounded-lg border border-border/70 bg-background/90 p-1"
                    role="radiogroup"
                    aria-label="Project region"
                  >
                    {regionOptions.map((option) => (
                      <Tooltip key={option.value}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            role="radio"
                            variant={projectRegion === option.value ? "secondary" : "ghost"}
                            aria-checked={projectRegion === option.value}
                            onClick={() => updateProjectRegion(option.value)}
                            className="min-w-0"
                          >
                            {option.label}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center">
                          Switch between metric and imperial defaults
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </ImmediateTooltipProvider>
                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                  This is not a conversion switch for old work. It tells [s]paceforge which assumptions to make next.
                </p>
              </div>

              <div
                aria-labelledby="editor-settings-unit-origin-title"
                className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
              >
                <div>
                  <h3 id="editor-settings-unit-origin-title" className="text-sm font-medium text-foreground">
                    Unit origin highlight
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Softly color-code elements by the unit family they were created with.
                  </p>
                </div>

                <ImmediateTooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="mt-3 inline-flex w-full sm:w-auto">
                        <Button
                          type="button"
                          size="sm"
                          variant={unitOriginHighlightsActive ? "secondary" : "outline"}
                          aria-pressed={unitOriginHighlightsActive}
                          disabled={!canShowUnitOriginHighlights}
                          onClick={() =>
                            updateSettings({
                              showUnitOriginHighlights: !areUnitOriginHighlightsVisible,
                            })
                          }
                          className="min-w-32 flex-1 sm:flex-none disabled:cursor-not-allowed"
                        >
                          {unitOriginHighlightsActive ? "Highlights on" : "Highlights off"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                      {unitOriginHighlightTooltip}
                    </TooltipContent>
                  </Tooltip>
                </ImmediateTooltipProvider>
              </div>
            </div>

            <div
              aria-labelledby="editor-settings-asset-defaults-title"
              className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div>
                  <h3 id="editor-settings-asset-defaults-title" className="text-sm font-medium text-foreground">
                    Asset defaults
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    New assets use these starting dimensions when the project region is {projectRegion}.
                  </p>
                </div>
                <span className="w-fit shrink-0 rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {projectRegion}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {REGIONAL_ASSET_DEFAULTS.map((asset) => (
                  <div
                    key={asset.type}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground">
                      {asset.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {getInteriorAssetDisplayName(asset.type, projectRegion)}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {projectRegion === "imperial" ? asset.imperialSize : asset.metricSize}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="export" className={tabContentClassName}>
          <section className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div
              aria-labelledby="editor-settings-export-title"
              className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
            >
              <div>
                <h3 id="editor-settings-export-title" className="text-sm font-medium text-foreground">
                  Export signature
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Add an optional designer credit to exported PNGs without keeping a text field in the toolbar.
                </p>
              </div>

              <div className="mt-3 space-y-2.5">
                <label
                  htmlFor="editor-settings-export-signature"
                  className="text-xs font-medium text-foreground"
                >
                  Designed by
                </label>
                <Input
                  id="editor-settings-export-signature"
                  type="text"
                  value={settings.exportSignatureText}
                  onChange={(event) => updateSettings({ exportSignatureText: event.target.value })}
                  maxLength={EDITOR_EXPORT_SIGNATURE_MAX_LENGTH}
                  placeholder="Your name or studio"
                  aria-describedby="editor-settings-export-signature-help"
                  className="h-9"
                />
                <p
                  id="editor-settings-export-signature-help"
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  Exported images will show{" "}
                  <span className="font-medium text-foreground/90">
                    {`"Designed by ${normalizedExportSignature || "your name"}"`}
                  </span>{" "}
                  when this field is filled in.
                </p>
              </div>
            </div>

            <div
              aria-labelledby="editor-settings-export-details-title"
              className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
            >
              <h3 id="editor-settings-export-details-title" className="text-sm font-medium text-foreground">
                Export details
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Exported images include the current canvas view and any optional signature configured here.
              </p>
              <div className="mt-3 rounded-lg border border-border/60 bg-background/70 p-2.5">
                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  Designed with [s]paceforge
                  <br />
                  spaceforge.app
                </p>
              </div>
            </div>
          </section>
        </TabsContent>
          </div>
        </div>
      </Tabs>
    </ResponsiveDialog>
  );
}
