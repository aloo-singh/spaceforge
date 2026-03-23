"use client";

import { useState } from "react";
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
import { MobileDrawerShell } from "@/components/ui/mobile-drawer-shell";
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
  const mobileTitleId = useState(() => `mobile-alert-title-${Math.random().toString(36).slice(2)}`)[0];
  const mobileDescriptionId = useState(() => `mobile-alert-description-${Math.random().toString(36).slice(2)}`)[0];
  const isMobile = useMobile();
  const resolvedSurface = surfaceOverride ?? (isMobile ? "drawer" : "dialog");
  const isDrawer = resolvedSurface === "drawer";

  if (isDrawer) {
    return (
      <MobileDrawerShell
        open={open}
        onOpenChange={onOpenChange}
        className={className}
        dismissible={false}
        titleId={mobileTitleId}
        descriptionId={description ? mobileDescriptionId : undefined}
      >
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
        {children ? <div className={cn(contentClassName)}>{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-col-reverse gap-2">{footer}</div> : null}
      </MobileDrawerShell>
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
