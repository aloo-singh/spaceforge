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
      <Empty className={cn("min-h-[12rem] justify-start border-dashed bg-transparent p-0 shadow-none")}>
        <EmptyHeader>
          <EmptyTitle>No room selected</EmptyTitle>
          <EmptyDescription className="max-w-[26ch]">
            The inspector stays ready here while the canvas remains the primary focus.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </EditorInspectorSection>
  );
}
