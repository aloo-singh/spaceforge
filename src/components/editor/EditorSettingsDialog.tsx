"use client";

import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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
  const measurementDisplayMode = useEditorStore((state) => state.settings.measurementDisplayMode);

  return (
    <ResponsiveDialog
      contentId={contentId}
      open={open}
      onOpenChange={onOpenChange}
      title="Editor settings"
      description="A lightweight home for editor preferences. Additional options will land here as display and accessibility controls are introduced."
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
          aria-labelledby="editor-settings-measurements-title"
          className="rounded-lg border border-border/70 bg-muted/30 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="editor-settings-measurements-title" className="text-sm font-medium text-foreground">
                Measurements
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Current editor behaviour stays interaction-based for now. Future visibility and unit
                controls will extend this section.
              </p>
            </div>
            <dl className="shrink-0">
              <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <dt className="sr-only">Measurement display mode</dt>
                <dd>{formatMeasurementDisplayMode(measurementDisplayMode)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div
          aria-labelledby="editor-settings-coming-soon-title"
          className="rounded-lg border border-dashed border-border/70 p-3"
        >
          <h3 id="editor-settings-coming-soon-title" className="text-sm font-medium text-foreground">
            Coming soon
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Dimensions visibility, typography sizing, and other editor display preferences will be
            added here incrementally.
          </p>
        </div>
      </section>
    </ResponsiveDialog>
  );
}

function formatMeasurementDisplayMode(value: string): string {
  if (value === "interactive") return "Interactive";
  return value;
}
