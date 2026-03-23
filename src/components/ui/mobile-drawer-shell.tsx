"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const MOBILE_DRAWER_EXIT_MS = 360;

type MobileDrawerShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  titleId?: string;
  descriptionId?: string;
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors.join(","))).filter(
    (element) => !element.hasAttribute("aria-hidden")
  );
}

export function MobileDrawerShell({
  open,
  onOpenChange,
  children,
  className,
  dismissible = true,
  panelRef,
  titleId,
  descriptionId,
}: MobileDrawerShellProps) {
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(false);
  const internalPanelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const activePanelRef = panelRef ?? internalPanelRef;

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (open) {
      const openTimer = window.setTimeout(() => {
        previouslyFocusedElementRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;

        setIsMounted(true);
        window.requestAnimationFrame(() => {
          setIsVisible(true);
        });
      }, 0);

      return () => {
        window.clearTimeout(openTimer);
      };
    }

    if (!isMounted) {
      return;
    }

    const closeFrame = window.requestAnimationFrame(() => {
      setIsVisible(false);
    });
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsMounted(false);
      closeTimeoutRef.current = null;
      previouslyFocusedElementRef.current?.focus();
      previouslyFocusedElementRef.current = null;
    }, MOBILE_DRAWER_EXIT_MS);

    return () => {
      window.cancelAnimationFrame(closeFrame);
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isMounted, open]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMounted]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const panelElement = activePanelRef.current;
      if (!panelElement) {
        return;
      }

      const firstFocusableElement = getFocusableElements(panelElement)[0];
      if (firstFocusableElement) {
        firstFocusableElement.focus();
        return;
      }

      panelElement.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activePanelRef, onOpenChange, open]);

  if (!isMounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-stretch">
      <button
        type="button"
        aria-label="Close drawer"
        tabIndex={dismissible ? 0 : -1}
        onClick={() => {
          if (dismissible) {
            onOpenChange(false);
          }
        }}
        className={cn(
          "absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none",
          isVisible ? "opacity-100 duration-[320ms] ease-out" : "pointer-events-none opacity-0 duration-[220ms] ease-in"
        )}
      />
      <div
        ref={activePanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-h-[calc(100dvh-0.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-2xl border border-border/70 bg-card px-4 pt-3 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+0.75rem))] text-card-foreground shadow-xl outline-none",
          "will-change-[transform,opacity] transition-[transform,opacity] motion-reduce:transition-none",
          isVisible
            ? "translate-y-0 opacity-100 duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            : "translate-y-[calc(100%+1rem)] opacity-0 duration-[360ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          className
        )}
      >
        <div className="mb-3 flex justify-center" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-border/80" />
        </div>
        <div className="min-h-0 pb-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
