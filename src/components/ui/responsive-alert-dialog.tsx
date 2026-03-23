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
  const isDrawer = resolvedSurface === "drawer";
  const overlayClassName = isDrawer
    ? cn(
        "transition-opacity duration-[320ms] ease-out motion-reduce:transition-none",
        "data-[state=open]:opacity-100 data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0"
      )
    : cn(
        "transition-opacity duration-200 ease-out motion-reduce:transition-none",
        "data-[state=open]:opacity-100 data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0"
      );
  const contentClassNames = isDrawer
    ? cn(
        "top-auto right-0 bottom-0 left-0 max-w-none rounded-t-2xl rounded-b-none px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
        "translate-x-0 will-change-[transform,opacity] transition-[transform,opacity] duration-[520ms] motion-reduce:transition-none",
        "ease-[cubic-bezier(0.16,1,0.3,1)]",
        "data-[state=open]:translate-y-0 data-[state=open]:opacity-100",
        "data-[state=closed]:pointer-events-none data-[state=closed]:translate-y-[calc(100%+1rem)] data-[state=closed]:opacity-0"
      )
    : cn(
        "w-[min(100%,28rem)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
        "data-[state=open]:translate-y-[-50%] data-[state=open]:scale-100 data-[state=open]:opacity-100",
        "data-[state=closed]:pointer-events-none data-[state=closed]:translate-y-[calc(-50%+0.5rem)] data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0"
      );

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
        <AlertDialogOverlay className={overlayClassName} />
        <AlertDialogContent
          className={cn(
            contentClassNames,
            className
          )}
        >
          {isDrawer ? (
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
            <AlertDialogFooter className={isDrawer ? "mt-6" : "mt-2"}>
              {footer}
            </AlertDialogFooter>
          ) : null}
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
