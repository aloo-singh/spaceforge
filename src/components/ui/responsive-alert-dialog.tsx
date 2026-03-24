"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type ResponsiveAlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  surfaceOverride?: "dialog" | "drawer";
};

export function ResponsiveAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  surfaceOverride,
}: ResponsiveAlertDialogProps) {
  const { isMobile, isReady: isMobileReady } = useMobile();
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
        dismissible={false}
      >
        <DrawerContent className={className}>
          <DrawerHandle />
          <div className="min-w-0 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-5">
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
              {description ? <DrawerDescription>{description}</DrawerDescription> : null}
            </DrawerHeader>
            {children ? <div className={cn(contentClassName)}>{children}</div> : null}
            {footer ? <DrawerFooter className="mt-6">{footer}</DrawerFooter> : null}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogContent
          className={cn(
            "w-[min(100%,28rem)] animate-in zoom-in-95 fade-in-0 duration-200",
            className
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {children ? <div className={cn(contentClassName)}>{children}</div> : null}
          {footer ? <AlertDialogFooter className="mt-2">{footer}</AlertDialogFooter> : null}
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
