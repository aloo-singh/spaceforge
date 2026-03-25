"use client";

import { useId } from "react";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMobile } from "@/lib/use-mobile";
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
  footerClassName?: string;
  stickyFooter?: boolean;
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
  footerClassName,
  stickyFooter = false,
  hideHeader = false,
  motionState = "open",
  surfaceOverride,
  panelRef,
}: ResponsiveDialogProps) {
  const fallbackContentId = useId();
  const { isMobile, isReady: isMobileReady } = useMobile();
  const resolvedContentId = contentId ?? fallbackContentId;
  if (!surfaceOverride && open && !isMobileReady) {
    return null;
  }

  const resolvedSurface = surfaceOverride ?? (isMobile ? "drawer" : "dialog");
  const isDrawer = resolvedSurface === "drawer";

  if (isDrawer) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        shouldScaleBackground={false}
        direction="bottom"
      >
        <DrawerContent
          ref={panelRef}
          className={cn(stickyFooter && "overflow-hidden", className)}
        >
          <DrawerHandle />
          <div
            className={cn(
              "min-w-0 px-4 pt-3 sm:px-5",
              stickyFooter
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            )}
          >
            {hideHeader ? (
              <DrawerHeader className="sr-only">
                <DrawerTitle>{title}</DrawerTitle>
                {description ? <DrawerDescription>{description}</DrawerDescription> : null}
              </DrawerHeader>
            ) : (
              <DrawerHeader>
                <DrawerTitle>{title}</DrawerTitle>
                {description ? <DrawerDescription>{description}</DrawerDescription> : null}
              </DrawerHeader>
            )}
            {children ? (
              <div
                className={cn(
                  hideHeader ? "" : "mt-5",
                  stickyFooter && "min-h-0 flex-1 overflow-y-auto",
                  contentClassName
                )}
              >
                {children}
              </div>
            ) : null}
            {footer ? (
              <DrawerFooter
                className={cn(
                  stickyFooter &&
                    "shrink-0 border-t border-border/60 bg-card px-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3",
                  !stickyFooter && "mt-6",
                  footerClassName
                )}
              >
                {footer}
              </DrawerFooter>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
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
            "w-[min(100%,28rem)] max-h-[calc(100vh-2rem)] p-5",
            stickyFooter ? "flex min-h-0 flex-col overflow-hidden" : "overflow-y-auto",
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
          {children ? (
            <div
              className={cn(
                hideHeader ? "" : "mt-5",
                stickyFooter && "min-h-0 flex-1 overflow-y-auto",
                contentClassName
              )}
            >
              {children}
            </div>
          ) : null}
          {footer ? (
            <DialogFooter
              className={cn(
                stickyFooter &&
                  "mt-4 shrink-0 border-t border-border/60 bg-card pt-3 sm:justify-end",
                !stickyFooter && "mt-6 sm:justify-end",
                footerClassName
              )}
            >
              {footer}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
