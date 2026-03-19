"use client";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type EditorInspectorEmptyStateProps = {
  className?: string;
};

export function EditorInspectorEmptyState({ className }: EditorInspectorEmptyStateProps) {
  return (
    <Empty className={cn("shadow-sm", className)}>
      <EmptyHeader>
        <EmptyTitle>Inspector</EmptyTitle>
        <EmptyDescription>
          Select a room to view its details and editing options here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
