"use client";

import { EditorInspectorSection } from "@/components/editor/EditorInspectorSection";

type RulerInspectorProps = {
  className?: string;
};

export function RulerInspector({ className }: RulerInspectorProps) {
  return (
    <EditorInspectorSection
      title="Ruler Tool"
      className={className}
      bodyClassName="flex flex-col gap-3"
    >
      <p className="text-sm leading-relaxed text-foreground/80">
        Distance measurements will appear here once ruler drawing is added.
      </p>
    </EditorInspectorSection>
  );
}
