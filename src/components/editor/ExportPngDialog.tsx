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
import {
  PROJECT_EXPORT_DESCRIPTION_MAX_LENGTH,
  PROJECT_EXPORT_TITLE_MAX_LENGTH,
} from "@/lib/projects/exportConfig";

export type ExportPngThemeOption = "light" | "dark" | "system";

export type ExportPngRequest = {
  title: string;
  description: string;
  showLegend: boolean;
  showScaleBar: boolean;
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
  showLegend: boolean;
  showScaleBar: boolean;
  showGrid: boolean;
  showDimensions: boolean;
  theme: ExportPngThemeOption;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onShowLegendChange: (value: boolean) => void;
  onShowScaleBarChange: (value: boolean) => void;
  onShowGridChange: (value: boolean) => void;
  onShowDimensionsChange: (value: boolean) => void;
  onThemeChange: (value: ExportPngThemeOption) => void;
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
  showLegend,
  showScaleBar,
  showGrid,
  showDimensions,
  theme,
  onTitleChange,
  onDescriptionChange,
  onShowLegendChange,
  onShowScaleBarChange,
  onShowGridChange,
  onShowDimensionsChange,
  onThemeChange,
  currentThemeLabel,
  defaultDesignedBy = "",
}: ExportPngDialogProps) {
  const [designedBy, setDesignedBy] = useState(defaultDesignedBy);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const previewRequestIdRef = useRef(0);

  const isExportButtonDisabled = exportDisabled || isExporting;

  useEffect(() => {
    if (!open || !onPreviewRequest) return;

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    const timeoutId = window.setTimeout(() => {
      void onPreviewRequest({
        title,
        description,
        showLegend,
        showScaleBar,
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
        });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    open,
    onPreviewRequest,
    title,
    description,
    showLegend,
    showScaleBar,
    designedBy,
    showGrid,
    showDimensions,
    theme,
  ]);

  const handleExport = () => {
    if (isExportButtonDisabled) return;

    onOpenChange(false);
    void onExport({
      title,
      description,
      showLegend,
      showScaleBar,
      designedBy,
      showGrid,
      showDimensions,
      theme,
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Export PNG"
      description="Adjust a few export details without changing the live editor."
      className="sm:w-[min(100%,72rem)] sm:max-w-[72rem] sm:p-3.5"
      contentClassName="overflow-hidden pr-0"
      footerClassName="px-0"
      stickyFooter
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
      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,24rem)]">
        <section className="min-h-0">
          <div className="flex h-full min-h-[16rem] flex-col overflow-hidden rounded-[1.25rem] border border-border/70 bg-muted/25">
            <div className="border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-medium tracking-[-0.01em] text-foreground">Live preview</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Updates automatically as export settings change.
              </p>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
              <div className="flex h-full max-h-full w-full items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background/90 p-3">
                {previewSrc ? (
                  <div className="relative aspect-[4/5] h-full max-h-full w-full overflow-hidden rounded-lg">
                    <Image
                      src={previewSrc}
                      alt="Live PNG export preview"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/5] min-h-[14rem] w-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/30 px-6 text-center text-sm leading-relaxed text-muted-foreground">
                    Preview will appear here and stay in sync with the export settings.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto pr-1">
          <div className="space-y-2.5 pb-1">
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
              title="Show legend"
              description="Add a simple room list with names and areas beneath the plan."
              value={showLegend ? "On" : "Off"}
            >
              <BinaryChoice
                ariaLabel="Show legend"
                enabled={showLegend}
                onEnable={() => onShowLegendChange(true)}
                onDisable={() => onShowLegendChange(false)}
              />
            </ExportToggleCard>

            <ExportToggleCard
              title="Show scale bar"
              description="Add the current plan scale using the same measurement treatment as the canvas."
              value={showScaleBar ? "On" : "Off"}
            >
              <BinaryChoice
                ariaLabel="Show scale bar"
                enabled={showScaleBar}
                onEnable={() => onShowScaleBarChange(true)}
                onDisable={() => onShowScaleBarChange(false)}
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
      className="mt-2.5 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
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
