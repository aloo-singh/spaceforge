"use client";

import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

type RoomDrawingInspectorProps = {
  className?: string;
};

export function RoomDrawingInspector({ className }: RoomDrawingInspectorProps) {
  return (
    <EditorInspectorSection
      title="Freeform room draw"
      className={className}
      bodyClassName="flex flex-col gap-4"
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-foreground/80">
          Click to place points and sketch your space. Close the loop back to your starting point to finish the room. The canvas helps you stay aligned, gently guiding without getting in the way.
        </p>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Keyboard shortcuts
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-foreground/80">45° angles</span>
              <KbdGroup>
                <Kbd>Shift</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-foreground/80">Undo last point</span>
              <KbdGroup>
                <Kbd>⌫</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-foreground/80">Toggle snapping</span>
              <KbdGroup>
                <Kbd>S</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-foreground/80">Toggle guides</span>
              <KbdGroup>
                <Kbd>G</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-foreground/80">Pan canvas</span>
              <KbdGroup>
                <Kbd>Space</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm text-foreground/80">Cancel drawing</span>
              <KbdGroup>
                <Kbd>Esc</Kbd>
              </KbdGroup>
            </div>
          </div>
        </div>
      </div>
    </EditorInspectorSection>
  );
}
