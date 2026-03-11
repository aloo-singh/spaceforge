"use client";

import { useEffect, useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "w-full rounded-t-2xl border border-border/70 bg-card p-5 text-card-foreground shadow-xl sm:max-w-md sm:rounded-xl",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
