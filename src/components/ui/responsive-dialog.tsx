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
import { MobileDrawerShell } from "@/components/ui/mobile-drawer-shell";
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
  const mobileTitleId = useId();
  const mobileDescriptionId = useId();
  const [isMobile, setIsMobile] = useState(false);
  const resolvedContentId = contentId ?? fallbackContentId;
  const resolvedSurface = surfaceOverride ?? (isMobile ? "drawer" : "dialog");
  const isDrawer = resolvedSurface === "drawer";

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

  if (isDrawer) {
    return (
      <MobileDrawerShell
        open={open}
        onOpenChange={onOpenChange}
        panelRef={panelRef}
        className={className}
        titleId={mobileTitleId}
        descriptionId={description ? mobileDescriptionId : undefined}
      >
        {hideHeader ? (
          <div className="sr-only">
            <h2 id={mobileTitleId} className="text-base font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={mobileDescriptionId} className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-left">
            <h2 id={mobileTitleId} className="text-base font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={mobileDescriptionId} className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        )}
        {children ? <div className={cn(hideHeader ? "" : "mt-5", contentClassName)}>{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-col-reverse gap-2">{footer}</div> : null}
      </MobileDrawerShell>
    );
  }

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
            "w-[min(100%,28rem)] max-h-[calc(100vh-2rem)] overflow-y-auto p-5",
            motionState === "opening" && "animate-in zoom-in-95 fade-in-0 duration-200",
            motionState === "closing" && "animate-out zoom-out-95 fade-out-0 duration-150",
            className
          )}
        >
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
          {footer ? <DialogFooter className="mt-6 sm:justify-end">{footer}</DialogFooter> : null}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
