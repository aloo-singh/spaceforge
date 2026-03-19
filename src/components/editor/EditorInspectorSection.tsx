"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EditorInspectorSectionProps = {
  title: string;
  description?: string;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

export function EditorInspectorSection({
  title,
  description,
  className,
  bodyClassName,
  children,
}: EditorInspectorSectionProps) {
  return (
    <section
      className={cn(
        "pointer-events-auto rounded-xl border border-border/70 bg-card/95 p-4 text-card-foreground shadow-sm backdrop-blur-sm [@media(max-height:540px)_and_(orientation:landscape)]:p-3",
        className
      )}
    >
      <header className="space-y-1 border-b border-border/60 pb-3 [@media(max-height:540px)_and_(orientation:landscape)]:pb-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground [@media(max-height:540px)_and_(orientation:landscape)]:text-[10px]">
          {title}
        </p>
        {description ? (
          <p className="max-w-[28ch] text-sm leading-relaxed text-muted-foreground [@media(max-height:540px)_and_(orientation:landscape)]:max-w-[24ch] [@media(max-height:540px)_and_(orientation:landscape)]:text-[13px]">
            {description}
          </p>
        ) : null}
      </header>
      <div className={cn("pt-4 [@media(max-height:540px)_and_(orientation:landscape)]:pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}
