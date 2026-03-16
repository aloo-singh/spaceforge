"use client";

import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { shouldShowDimensions } from "@/lib/editor/settings";
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
  const settings = useEditorStore((state) => state.settings);
  const updateSettings = useEditorStore((state) => state.updateSettings);
  const dimensionsVisible = shouldShowDimensions(settings);

  return (
    <ResponsiveDialog
      contentId={contentId}
      open={open}
      onOpenChange={onOpenChange}
      title="Editor settings"
      description="A lightweight home for editor preferences. Display and accessibility controls will continue to land here incrementally."
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
      <section className="space-y-3.5">
        <div
          aria-labelledby="editor-settings-measurements-title"
          className="rounded-xl border border-border/70 bg-muted/30 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="editor-settings-measurements-title" className="text-sm font-medium text-foreground">
                Dimensions
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Show or hide room area and live dimension overlays while keeping the editor calm.
              </p>
            </div>
            <dl className="shrink-0">
              <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <dt className="sr-only">Dimensions visibility</dt>
                <dd>{dimensionsVisible ? "Shown" : "Hidden"}</dd>
              </div>
            </dl>
          </div>

          <div
            className="mt-3 inline-flex rounded-lg border border-border/70 bg-background p-1"
            role="group"
            aria-label="Dimensions visibility"
          >
            <Button
              type="button"
              size="sm"
              variant={dimensionsVisible ? "secondary" : "ghost"}
              aria-pressed={dimensionsVisible}
              onClick={() => updateSettings({ dimensionsVisibility: "visible" })}
              className="min-w-20"
            >
              Show
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!dimensionsVisible ? "secondary" : "ghost"}
              aria-pressed={!dimensionsVisible}
              onClick={() => updateSettings({ dimensionsVisibility: "hidden" })}
              className="min-w-20"
            >
              Hide
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Hold Alt/Option to temporarily invert this while drawing or resizing.
          </p>
        </div>

        <div
          aria-labelledby="editor-settings-coming-soon-title"
          className="rounded-xl border border-dashed border-border/70 p-3"
        >
          <h3 id="editor-settings-coming-soon-title" className="text-sm font-medium text-foreground">
            Coming soon
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Typography sizing and units will be added here incrementally.
          </p>
        </div>
      </section>
    </ResponsiveDialog>
  );
}
