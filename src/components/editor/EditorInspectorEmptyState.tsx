"use client";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";
import { cn } from "@/lib/utils";

type EditorInspectorEmptyStateProps = {
  className?: string;
};

export function EditorInspectorEmptyState({ className }: EditorInspectorEmptyStateProps) {
  return (
    <EditorInspectorSection
      title="Inspector"
      description="Select a room to view its details and editing options here."
      className={className}
      bodyClassName="flex h-full items-center"
    >
      <Empty
        className={cn(
          "min-h-[12rem] justify-start border-dashed border-slate-300/80 bg-slate-50/70 p-4 shadow-none dark:border-border/70 dark:bg-transparent"
        )}
      >
        <EmptyHeader>
          <EmptyTitle className="text-slate-950 dark:text-foreground">No room selected</EmptyTitle>
          <EmptyDescription className="max-w-[26ch] text-slate-600 dark:text-muted-foreground">
            The inspector stays ready here while the canvas remains the primary focus.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </EditorInspectorSection>
  );
}
