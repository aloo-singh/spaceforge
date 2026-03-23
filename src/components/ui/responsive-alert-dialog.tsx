"use client";

import { useEffect, useState } from "react";
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
  const [isMobile, setIsMobile] = useState(false);
  const resolvedSurface = surfaceOverride ?? (isMobile ? "drawer" : "dialog");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogContent
          className={cn(
            resolvedSurface === "drawer"
              ? "top-auto right-0 bottom-0 left-0 max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
              : "w-[min(100%,28rem)]",
            className
          )}
        >
          {resolvedSurface === "drawer" ? (
            <div className="mb-3 flex justify-center" aria-hidden="true">
              <span className="h-1.5 w-12 rounded-full bg-border/80" />
            </div>
          ) : null}
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {children ? <div className={cn(contentClassName)}>{children}</div> : null}
          {footer ? (
            <AlertDialogFooter className={resolvedSurface === "drawer" ? "mt-6" : "mt-2"}>
              {footer}
            </AlertDialogFooter>
          ) : null}
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
