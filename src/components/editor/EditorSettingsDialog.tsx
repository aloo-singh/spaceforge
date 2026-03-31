"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  EDITOR_EXPORT_SIGNATURE_MAX_LENGTH,
  normalizeEditorExportSignature,
  shouldShowDimensions,
} from "@/lib/editor/settings";
import { useEditorStore } from "@/stores/editorStore";

type EditorSettingsDialogProps = {
  contentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditorSettingsDialog({
  contentId,
  open,
  onOpenChange,
}: EditorSettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const settings = useEditorStore((state) => state.settings);
  const updateSettings = useEditorStore((state) => state.updateSettings);
  const dimensionsVisible = shouldShowDimensions(settings);
  const isLargeMeasurementText = settings.measurementFontSize === "large";
  const isWallMeasurementInside = settings.wallMeasurementPosition === "inside";
  const areGuidelinesVisible = settings.showGuidelines;
  const isSnappingEnabled = settings.snappingEnabled;
  const normalizedExportSignature = normalizeEditorExportSignature(settings.exportSignatureText);
  const selectedAppearance = theme === "light" || theme === "dark" ? theme : "system";

  return (
    <ResponsiveDialog
      contentId={contentId}
      open={open}
      onOpenChange={onOpenChange}
      title="Editor settings"
      description="A focused home for editor preferences."
      className="sm:w-[min(100%,32rem)] sm:p-4"
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
      <section className="space-y-3">
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
            <dl className="shrink-0 self-start">
              <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                <dt className="sr-only">Appearance mode</dt>
                <dd>{selectedAppearance}</dd>
              </div>
            </dl>
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
          aria-labelledby="editor-settings-measurements-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
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
            <dl className="shrink-0 self-start">
              <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <dt className="sr-only">Dimensions visibility</dt>
                <dd>{dimensionsVisible ? "Shown" : "Hidden"}</dd>
              </div>
            </dl>
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
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
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
            <dl className="shrink-0 self-start">
              <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <dt className="sr-only">Measurement text size</dt>
                <dd>{isLargeMeasurementText ? "Large" : "Normal"}</dd>
              </div>
            </dl>
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
          aria-labelledby="editor-settings-guidelines-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-guidelines-title" className="text-sm font-medium text-foreground">
                Show guidelines
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Show predictive muted guides from nearby room edges while moving, drawing, and resizing.
              </p>
            </div>
            <dl className="shrink-0 self-start">
              <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <dt className="sr-only">Guidelines status</dt>
                <dd>{areGuidelinesVisible ? "On" : "Off"}</dd>
              </div>
            </dl>
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
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-snapping-title" className="text-sm font-medium text-foreground">
                Enable snapping
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Magnetically snap active edits to the current grid and nearby predictive guides.
              </p>
            </div>
            <dl className="shrink-0 self-start">
              <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <dt className="sr-only">Snapping status</dt>
                <dd>{isSnappingEnabled ? "On" : "Off"}</dd>
              </div>
            </dl>
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
          aria-labelledby="editor-settings-export-title"
          className="rounded-xl border border-border/70 bg-muted/25 p-3.5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h3 id="editor-settings-export-title" className="text-sm font-medium text-foreground">
                Export signature
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Add an optional designer credit to exported PNGs without keeping a text field in the
                toolbar.
              </p>
            </div>
            <dl className="shrink-0 self-start">
              <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <dt className="sr-only">Export signature status</dt>
                <dd>{normalizedExportSignature ? "On" : "Off"}</dd>
              </div>
            </dl>
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
              Exported images will show
              {" "}
              <span className="font-medium text-foreground/90">
                {`"Designed by ${normalizedExportSignature || "your name"}"`}
              </span>
              {" "}
              when this field is filled in.
            </p>
          </div>
        </div>
      </section>
    </ResponsiveDialog>
  );
}
