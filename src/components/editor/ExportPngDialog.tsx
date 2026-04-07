"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { EDITOR_EXPORT_SIGNATURE_MAX_LENGTH } from "@/lib/editor/settings";
import type {
  EditorExportLegendPosition,
  EditorExportScaleBarPosition,
} from "@/lib/editor/exportPreferences";
import {
  PROJECT_EXPORT_DESCRIPTION_MAX_LENGTH,
  PROJECT_EXPORT_TITLE_MAX_LENGTH,
  type ProjectExportDescriptionPosition,
  type ProjectExportTitlePosition,
} from "@/lib/projects/exportConfig";
import { cn } from "@/lib/utils";

export type ExportPngThemeOption = "light" | "dark" | "system";

export type ExportPngRequest = {
  title: string;
  description: string;
  titlePosition: ProjectExportTitlePosition;
  descriptionPosition: ProjectExportDescriptionPosition;
  includeNorthIndicator: boolean;
  showLegend: boolean;
  showScaleBar: boolean;
  legendPosition: EditorExportLegendPosition;
  scaleBarPosition: EditorExportScaleBarPosition;
  designedBy: string;
  showGrid: boolean;
  showDimensions: boolean;
  theme: ExportPngThemeOption;
};

type ExportPngDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (request: ExportPngRequest) => void | Promise<void>;
  onPreviewRequest?: (request: ExportPngRequest) => Promise<string | null>;
  isExporting?: boolean;
  exportDisabled?: boolean;
  exportDisabledReason?: string;
  title: string;
  description: string;
  titlePosition: ProjectExportTitlePosition;
  descriptionPosition: ProjectExportDescriptionPosition;
  showLegend: boolean;
  showScaleBar: boolean;
  showGrid: boolean;
  showDimensions: boolean;
  theme: ExportPngThemeOption;
  legendPosition: EditorExportLegendPosition;
  scaleBarPosition: EditorExportScaleBarPosition;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTitlePositionChange: (value: ProjectExportTitlePosition) => void;
  onDescriptionPositionChange: (value: ProjectExportDescriptionPosition) => void;
  onShowLegendChange: (value: boolean) => void;
  onShowScaleBarChange: (value: boolean) => void;
  onShowGridChange: (value: boolean) => void;
  onShowDimensionsChange: (value: boolean) => void;
  onThemeChange: (value: ExportPngThemeOption) => void;
  onLegendPositionChange: (value: EditorExportLegendPosition) => void;
  onScaleBarPositionChange: (value: EditorExportScaleBarPosition) => void;
  currentThemeLabel: "Light" | "Dark";
  defaultDesignedBy?: string;
};

export function ExportPngDialog({
  open,
  onOpenChange,
  onExport,
  onPreviewRequest,
  isExporting = false,
  exportDisabled = false,
  exportDisabledReason,
  title,
  description,
  titlePosition,
  descriptionPosition,
  showLegend,
  showScaleBar,
  showGrid,
  showDimensions,
  theme,
  legendPosition,
  scaleBarPosition,
  onTitleChange,
  onDescriptionChange,
  onTitlePositionChange,
  onDescriptionPositionChange,
  onShowLegendChange,
  onShowScaleBarChange,
  onShowGridChange,
  onShowDimensionsChange,
  onThemeChange,
  onLegendPositionChange,
  onScaleBarPositionChange,
  currentThemeLabel,
  defaultDesignedBy = "",
}: ExportPngDialogProps) {
  const [designedBy, setDesignedBy] = useState(defaultDesignedBy);
  const [includeNorthIndicator, setIncludeNorthIndicator] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState({ width: 1600, height: 1200 });
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false);
  const [isPreviewRefreshVisible, setIsPreviewRefreshVisible] = useState(false);
  const previewRequestIdRef = useRef(0);

  const isExportButtonDisabled = exportDisabled || isExporting;
  const effectiveLegendPosition: EditorExportLegendPosition =
    showLegend && legendPosition !== "none" ? legendPosition : "none";
  const effectiveScaleBarPosition: EditorExportScaleBarPosition =
    showScaleBar && scaleBarPosition !== "none" ? scaleBarPosition : "none";

  useEffect(() => {
    if (!open || !onPreviewRequest) return;

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    let refreshIndicatorTimeoutId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      setIsPreviewRefreshing(true);
      refreshIndicatorTimeoutId = window.setTimeout(() => {
        if (previewRequestIdRef.current !== requestId) return;
        setIsPreviewRefreshVisible(true);
      }, 160);

      void onPreviewRequest({
        title,
        description,
        titlePosition,
        descriptionPosition,
        includeNorthIndicator,
        showLegend: effectiveLegendPosition !== "none",
        showScaleBar: effectiveScaleBarPosition !== "none",
        legendPosition: effectiveLegendPosition,
        scaleBarPosition: effectiveScaleBarPosition,
        designedBy,
        showGrid,
        showDimensions,
        theme,
      })
        .then((nextPreviewSrc) => {
          if (previewRequestIdRef.current !== requestId) return;
          if (nextPreviewSrc) {
            setPreviewSrc(nextPreviewSrc);
          }
        })
        .catch((error) => {
          if (previewRequestIdRef.current !== requestId) return;
          console.error("PNG preview render failed.", error);
        })
        .finally(() => {
          if (previewRequestIdRef.current !== requestId) return;
          if (refreshIndicatorTimeoutId !== null) {
            window.clearTimeout(refreshIndicatorTimeoutId);
          }
          setIsPreviewRefreshing(false);
          setIsPreviewRefreshVisible(false);
        });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      if (refreshIndicatorTimeoutId !== null) {
        window.clearTimeout(refreshIndicatorTimeoutId);
      }
    };
  }, [
    open,
    onPreviewRequest,
    title,
    description,
    titlePosition,
    descriptionPosition,
    includeNorthIndicator,
    effectiveLegendPosition,
    effectiveScaleBarPosition,
    designedBy,
    showGrid,
    showDimensions,
    theme,
  ]);

  const handleExport = () => {
    if (isExportButtonDisabled) return;

    handleOpenChange(false);
    void onExport({
      title,
      description,
      titlePosition,
      descriptionPosition,
      includeNorthIndicator,
      showLegend: effectiveLegendPosition !== "none",
      showScaleBar: effectiveScaleBarPosition !== "none",
      legendPosition: effectiveLegendPosition,
      scaleBarPosition: effectiveScaleBarPosition,
      designedBy,
      showGrid,
      showDimensions,
      theme,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsPreviewRefreshing(false);
      setIsPreviewRefreshVisible(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Export PNG"
      description="Adjust a few export details without changing the live editor."
      className="sm:h-[min(100vh-2rem,48rem)] sm:w-[min(100%,72rem)] sm:max-w-[72rem] sm:p-3.5"
      contentClassName="min-h-0 pr-0 overflow-y-auto lg:overflow-hidden"
      footerClassName="px-0"
      stickyFooter
      contentScrollable={false}
      footer={
        <Button
          type="button"
          onClick={handleExport}
          disabled={isExportButtonDisabled}
          title={isExportButtonDisabled ? exportDisabledReason : undefined}
          className="w-full sm:w-auto"
        >
          <Download />
          {isExporting ? "Exporting..." : "Export PNG"}
        </Button>
      }
    >
      <div className="grid min-h-0 gap-3 sm:gap-4 lg:h-full lg:grid-cols-[minmax(0,1.12fr)_minmax(22rem,23.5rem)] lg:grid-rows-[minmax(0,1fr)] lg:gap-4 lg:overflow-hidden xl:grid-cols-[minmax(0,1.08fr)_minmax(23rem,24.5rem)] xl:gap-5">
        <section className="min-h-0 lg:h-full">
          <div className="flex h-full min-h-[15.5rem] flex-col overflow-hidden rounded-[1.25rem] border border-border/70 bg-muted/25">
            <div className="border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-medium tracking-[-0.01em] text-foreground">Live preview</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Updates automatically as export settings change.
              </p>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4 lg:p-4">
              <div className="relative flex h-full max-h-full min-h-[16.5rem] w-full items-center justify-center overflow-hidden rounded-[1rem] border border-border/70 bg-background/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-[18rem] sm:p-4">
                {previewSrc ? (
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[0.875rem] border border-border/60 bg-background/80">
                    <Image
                      src={previewSrc}
                      alt="Live PNG export preview"
                      width={previewDimensions.width}
                      height={previewDimensions.height}
                      unoptimized
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="h-full w-full object-contain object-center p-2.5 sm:p-3"
                      onLoadingComplete={(image) => {
                        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
                        setPreviewDimensions({
                          width: image.naturalWidth,
                          height: image.naturalHeight,
                        });
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex h-full min-h-[14rem] w-full items-center justify-center rounded-[0.875rem] border border-dashed border-border/70 bg-muted/24 px-6 text-center text-sm leading-relaxed text-muted-foreground">
                    Preview will appear here and stay in sync with the export settings.
                  </div>
                )}
                <div
                  aria-hidden={!isPreviewRefreshing}
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-[0.875rem] transition-opacity duration-200",
                    isPreviewRefreshVisible ? "opacity-100" : "opacity-0"
                  )}
                >
                  <div className="absolute inset-0 bg-background/28 backdrop-blur-[1px]" />
                  <div className="absolute inset-x-4 top-4 h-1 rounded-full bg-border/55 overflow-hidden">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-foreground/18" />
                  </div>
                  <div className="absolute inset-x-4 bottom-4 h-9 rounded-[0.75rem] border border-border/45 bg-background/48" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="min-h-0 pr-1 lg:h-full lg:overflow-y-auto">
          <div className="space-y-2.5 pb-2 lg:pb-1">
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3.5">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div>
                  <h3 className="text-sm font-medium tracking-[-0.01em] text-foreground">Export details</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Add optional context without changing the live canvas.
                  </p>
                </div>
                <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground">
                  Optional
                </div>
              </div>

              <div className="mt-2.5 space-y-2.5">
                <div className="space-y-1">
                  <label htmlFor="export-png-title" className="text-[11px] font-medium tracking-[0.04em] text-foreground/88 uppercase">
                    Title
                  </label>
                  <Input
                    id="export-png-title"
                    type="text"
                    value={title}
                    onChange={(event) => onTitleChange(event.target.value)}
                    maxLength={PROJECT_EXPORT_TITLE_MAX_LENGTH}
                    placeholder="Project title"
                    className="h-9 bg-background/90"
                  />
                </div>

                <PositionChoice
                  ariaLabel="Title position"
                  value={titlePosition}
                  options={[
                    { label: "Top", value: "top" },
                    { label: "None", value: "none" },
                  ]}
                  onChange={onTitlePositionChange}
                />

                <div className="space-y-1">
                  <label htmlFor="export-png-description" className="text-[11px] font-medium tracking-[0.04em] text-foreground/88 uppercase">
                    Description
                  </label>
                  <Textarea
                    id="export-png-description"
                    value={description}
                    onChange={(event) => onDescriptionChange(event.target.value)}
                    maxLength={PROJECT_EXPORT_DESCRIPTION_MAX_LENGTH}
                    placeholder="Add a short note about the plan"
                    className="min-h-24 resize-none bg-background/90"
                  />
                </div>

                <PositionChoice
                  ariaLabel="Description position"
                  value={descriptionPosition}
                  options={[
                    { label: "Below title", value: "below-title" },
                    { label: "None", value: "none" },
                  ]}
                  onChange={onDescriptionPositionChange}
                />

                <div className="space-y-1">
                  <label htmlFor="export-png-designed-by" className="text-[11px] font-medium tracking-[0.04em] text-foreground/88 uppercase">
                    Designed by
                  </label>
                  <Input
                    id="export-png-designed-by"
                    type="text"
                    value={designedBy}
                    onChange={(event) =>
                      setDesignedBy(event.target.value.slice(0, EDITOR_EXPORT_SIGNATURE_MAX_LENGTH))
                    }
                    maxLength={EDITOR_EXPORT_SIGNATURE_MAX_LENGTH}
                    placeholder="Your name or studio"
                    className="h-9 bg-background/90"
                  />
                </div>
              </div>
            </div>

            <ExportToggleCard
              title="Legend"
              description="Add a simple room list with names and areas beneath the plan."
              value={
                effectiveLegendPosition === "bottom"
                  ? "Bottom"
                  : effectiveLegendPosition === "right-side"
                    ? "Right side"
                    : "None"
              }
            >
              <PositionChoice
                ariaLabel="Legend position"
                value={effectiveLegendPosition}
                options={[
                  { label: "Bottom", value: "bottom" },
                  { label: "Right side", value: "right-side" },
                  { label: "None", value: "none" },
                ]}
                onChange={(value) => {
                  onShowLegendChange(value !== "none");
                  onLegendPositionChange(value);
                }}
              />
            </ExportToggleCard>

            <ExportToggleCard
              title="Scale bar"
              description="Add the current plan scale using the same measurement treatment as the canvas."
              value={effectiveScaleBarPosition === "bottom-left" ? "Bottom-left" : "None"}
            >
              <PositionChoice
                ariaLabel="Scale bar position"
                value={effectiveScaleBarPosition}
                options={[
                  { label: "Bottom-left", value: "bottom-left" },
                  { label: "None", value: "none" },
                ]}
                onChange={(value) => {
                  onShowScaleBarChange(value !== "none");
                  onScaleBarPositionChange(value);
                }}
              />
            </ExportToggleCard>

            <ExportToggleCard
              title="Include north indicator"
              description="Pass north-indicator intent through the export request without changing the current PNG layout."
              value={includeNorthIndicator ? "On" : "Off"}
            >
              <BinaryChoice
                ariaLabel="Include north indicator"
                enabled={includeNorthIndicator}
                onEnable={() => setIncludeNorthIndicator(true)}
                onDisable={() => setIncludeNorthIndicator(false)}
              />
            </ExportToggleCard>

            <ExportToggleCard
              title="Show grid"
              description="Keep the calm layout grid in the exported image."
              value={showGrid ? "On" : "Off"}
            >
              <BinaryChoice
                ariaLabel="Show grid"
                enabled={showGrid}
                onEnable={() => onShowGridChange(true)}
                onDisable={() => onShowGridChange(false)}
              />
            </ExportToggleCard>

            <ExportToggleCard
              title="Show dimensions"
              description="Include room measurement text in the PNG without affecting the canvas."
              value={showDimensions ? "On" : "Off"}
            >
              <BinaryChoice
                ariaLabel="Show dimensions"
                enabled={showDimensions}
                onEnable={() => onShowDimensionsChange(true)}
                onDisable={() => onShowDimensionsChange(false)}
              />
            </ExportToggleCard>

            <ExportToggleCard
              title="Export theme"
              description={`Follow the editor or choose Light or Dark (${currentThemeLabel}).`}
              value={theme === "system" ? `System (${currentThemeLabel})` : theme === "light" ? "Light" : "Dark"}
            >
              <div
                className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg border border-border/70 bg-background/90 p-1"
                role="group"
                aria-label="Export theme"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={theme === "system" ? "secondary" : "ghost"}
                  aria-pressed={theme === "system"}
                  onClick={() => onThemeChange("system")}
                >
                  {`System (${currentThemeLabel})`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={theme === "light" ? "secondary" : "ghost"}
                  aria-pressed={theme === "light"}
                  onClick={() => onThemeChange("light")}
                >
                  Light
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={theme === "dark" ? "secondary" : "ghost"}
                  aria-pressed={theme === "dark"}
                  onClick={() => onThemeChange("dark")}
                >
                  Dark
                </Button>
              </div>
            </ExportToggleCard>

            <div className="rounded-xl border border-border/70 bg-muted/25 p-3.5">
              <p className="font-measurement text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Designed with
              </p>
              <BrandWordmark className="mt-2 text-base" />
              <p className="mt-1 font-measurement text-[11px] text-muted-foreground">spaceforge.app</p>
            </div>
          </div>
        </section>
      </div>
    </ResponsiveDialog>
  );
}

type ExportToggleCardProps = {
  title: string;
  description: string;
  value: string;
  children: ReactNode;
};

function ExportToggleCard({ title, description, value, children }: ExportToggleCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground">
          {value}
        </div>
      </div>
      {children}
    </div>
  );
}

type BinaryChoiceProps = {
  ariaLabel: string;
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
};

function BinaryChoice({ ariaLabel, enabled, onEnable, onDisable }: BinaryChoiceProps) {
  return (
    <div
      className="flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
      role="group"
      aria-label={ariaLabel}
    >
      <Button
        type="button"
        size="sm"
        variant={enabled ? "secondary" : "ghost"}
        aria-pressed={enabled}
        onClick={onEnable}
        className="min-w-20 flex-1 sm:flex-none"
      >
        On
      </Button>
      <Button
        type="button"
        size="sm"
        variant={!enabled ? "secondary" : "ghost"}
        aria-pressed={!enabled}
        onClick={onDisable}
        className="min-w-20 flex-1 sm:flex-none"
      >
        Off
      </Button>
    </div>
  );
}

type PositionChoiceOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type PositionChoiceProps<TValue extends string> = {
  ariaLabel: string;
  value: TValue;
  options: PositionChoiceOption<TValue>[];
  onChange: (value: TValue) => void;
};

function PositionChoice<TValue extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: PositionChoiceProps<TValue>) {
  return (
    <div
      className="grid w-full gap-1 rounded-lg border border-border/70 bg-background/90 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "secondary" : "ghost"}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
