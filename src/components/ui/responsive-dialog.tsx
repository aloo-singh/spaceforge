"use client";

import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ResponsiveDialogProps = {
  contentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  hideHeader?: boolean;
  motionState?: "opening" | "open" | "closing";
  surfaceOverride?: "dialog" | "drawer";
  panelRef?: React.RefObject<HTMLDivElement | null>;
};

export function ResponsiveDialog({
  contentId,
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  hideHeader = false,
  motionState = "open",
  surfaceOverride,
  panelRef,
}: ResponsiveDialogProps) {
  const fallbackContentId = useId();
  const [isMobile, setIsMobile] = useState(false);
  const resolvedContentId = contentId ?? fallbackContentId;
  const resolvedSurface = surfaceOverride ?? (isMobile ? "drawer" : "dialog");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const updateMatch = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);

    return () => {
      mediaQuery.removeEventListener("change", updateMatch);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          className={cn(
            motionState === "opening" && "animate-in fade-in-0 duration-300",
            motionState === "closing" && "animate-out fade-out-0 duration-200"
          )}
        />
        <DialogContent
          id={resolvedContentId}
          ref={panelRef}
          hideClose
          className={cn(
            resolvedSurface === "drawer"
              ? "top-auto right-0 bottom-0 left-0 max-h-[calc(100vh-0.75rem)] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-2xl rounded-b-none px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
              : "w-[min(100%,28rem)] max-h-[calc(100vh-2rem)] overflow-y-auto p-5",
            resolvedSurface === "drawer" && motionState === "opening" && "animate-in slide-in-from-bottom-8 duration-300",
            resolvedSurface === "drawer" && motionState === "closing" && "animate-out slide-out-to-bottom-8 duration-200",
            resolvedSurface === "dialog" && motionState === "opening" && "animate-in zoom-in-95 duration-200",
            resolvedSurface === "dialog" && motionState === "closing" && "animate-out zoom-out-95 duration-150",
            className
          )}
        >
          {resolvedSurface === "drawer" ? (
            <div className="mb-3 flex justify-center" aria-hidden="true">
              <span className="h-1.5 w-12 rounded-full bg-border/80" />
            </div>
          ) : null}
          {hideHeader ? (
            <DialogHeader className="sr-only">
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
          ) : (
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
          )}
          {children ? <div className={cn(hideHeader ? "" : "mt-5", contentClassName)}>{children}</div> : null}
          {footer ? (
            <DialogFooter className={cn("mt-6", resolvedSurface === "drawer" ? "" : "sm:justify-end")}>
              {footer}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
