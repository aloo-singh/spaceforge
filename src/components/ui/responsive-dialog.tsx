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
  const isDrawer = resolvedSurface === "drawer";
  const drawerOverlayClassName = cn(
    "transition-opacity duration-[320ms] ease-out motion-reduce:transition-none",
    "data-[state=open]:opacity-100 data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0"
  );
  const drawerContentClassName = cn(
    "top-auto right-0 bottom-0 left-0 max-h-[calc(100vh-0.75rem)] max-w-none rounded-t-2xl rounded-b-none px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
    "translate-x-0 will-change-[transform,opacity] transition-[transform,opacity] motion-reduce:transition-none",
    "ease-[cubic-bezier(0.16,1,0.3,1)]",
    "data-[state=open]:translate-y-0 data-[state=open]:opacity-100",
    "data-[state=closed]:pointer-events-none data-[state=closed]:translate-y-[calc(100%+1rem)] data-[state=closed]:opacity-0",
    motionState === "opening" && "duration-[520ms]",
    motionState === "open" && "duration-[520ms]",
    motionState === "closing" && "duration-[360ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
  );
  const dialogOverlayClassName = cn(
    "transition-opacity motion-reduce:transition-none",
    "data-[state=open]:opacity-100 data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0",
    motionState === "opening" && "duration-300 ease-out",
    motionState === "closing" && "duration-200 ease-in",
    motionState === "open" && "duration-200 ease-out"
  );
  const dialogContentClassName = cn(
    "w-[min(100%,28rem)] max-h-[calc(100vh-2rem)] overflow-y-auto p-5",
    "will-change-[transform,opacity] transition-[transform,opacity] motion-reduce:transition-none",
    "data-[state=open]:translate-y-[-50%] data-[state=open]:scale-100 data-[state=open]:opacity-100",
    "data-[state=closed]:pointer-events-none data-[state=closed]:translate-y-[calc(-50%+0.5rem)] data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0",
    motionState === "opening" && "animate-in zoom-in-95 fade-in-0 duration-200",
    motionState === "closing" && "animate-out zoom-out-95 fade-out-0 duration-150"
  );

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
            isDrawer ? drawerOverlayClassName : dialogOverlayClassName
          )}
        />
        <DialogContent
          id={resolvedContentId}
          ref={panelRef}
          hideClose
          className={cn(
            isDrawer ? drawerContentClassName : dialogContentClassName,
            isDrawer && "overflow-hidden",
            className
          )}
        >
          {isDrawer ? (
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
            <DialogFooter className={cn("mt-6", isDrawer ? "" : "sm:justify-end")}>
              {footer}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
