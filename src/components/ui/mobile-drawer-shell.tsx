"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const MOBILE_DRAWER_EXIT_MS = 360;
const MOBILE_DRAWER_MAX_HEIGHT = "calc(100dvh - 0.5rem)";
const MOBILE_DRAWER_SIDE_INSET_LEFT = "max(1rem, calc(env(safe-area-inset-left) + 0.25rem))";
const MOBILE_DRAWER_SIDE_INSET_RIGHT = "max(1rem, calc(env(safe-area-inset-right) + 0.25rem))";

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
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const internalPanelRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const enterFrameRef = useRef<number | null>(null);
  const latestOnOpenChangeRef = useRef(onOpenChange);
  const hasFocusedOnOpenRef = useRef(false);
  const activePanelRef = panelRef ?? internalPanelRef;

  useEffect(() => {
    latestOnOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      if (enterFrameRef.current !== null) {
        window.cancelAnimationFrame(enterFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (open) {
      if (enterFrameRef.current !== null) {
        window.cancelAnimationFrame(enterFrameRef.current);
        enterFrameRef.current = null;
      }
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }

      hasFocusedOnOpenRef.current = false;

      const openTimer = window.setTimeout(() => {
        previouslyFocusedElementRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;

        setIsMounted(true);
        enterFrameRef.current = window.requestAnimationFrame(() => {
          setIsVisible(true);
          enterFrameRef.current = null;
        });
      }, 0);

      return () => {
        window.clearTimeout(openTimer);
        if (enterFrameRef.current !== null) {
          window.cancelAnimationFrame(enterFrameRef.current);
          enterFrameRef.current = null;
        }
      };
    }

    if (!isMounted) {
      return;
    }

    const closeFrame = window.requestAnimationFrame(() => {
      setIsVisible(false);
    });
    const exitTimeout = window.setTimeout(() => {
      setIsMounted(false);
      setContentHeight(null);
      hasFocusedOnOpenRef.current = false;
      closeTimeoutRef.current = null;
      previouslyFocusedElementRef.current?.focus();
      previouslyFocusedElementRef.current = null;
    }, MOBILE_DRAWER_EXIT_MS);

    closeTimeoutRef.current = exitTimeout;

    return () => {
      window.cancelAnimationFrame(closeFrame);
      window.clearTimeout(exitTimeout);
      closeTimeoutRef.current = null;
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

  useLayoutEffect(() => {
    if (!isMounted) {
      return;
    }

    const contentElement = contentRef.current;
    if (!contentElement) {
      return;
    }

    const updateHeight = () => {
      setContentHeight(Math.ceil(contentElement.getBoundingClientRect().height));
    };

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    updateHeight();
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isMounted]);

  useEffect(() => {
    if (!open || !isMounted || hasFocusedOnOpenRef.current) {
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
        hasFocusedOnOpenRef.current = true;
        return;
      }

      panelElement.focus();
      hasFocusedOnOpenRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activePanelRef, isMounted, open]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        latestOnOpenChangeRef.current(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMounted]);

  if (!isMounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-40 overflow-x-hidden">
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
        className={cn(
          "absolute right-0 bottom-0 left-0 z-10 transform-gpu will-change-transform transition-transform motion-reduce:transition-none",
          isVisible
            ? "translate-y-0 duration-[440ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            : "translate-y-full duration-[320ms] ease-[cubic-bezier(0.4,0,1,1)]"
        )}
        style={{ paddingLeft: MOBILE_DRAWER_SIDE_INSET_LEFT, paddingRight: MOBILE_DRAWER_SIDE_INSET_RIGHT }}
      >
        <div
          ref={activePanelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          className={cn(
            "relative w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-2xl border border-border/70 bg-card text-card-foreground shadow-xl outline-none",
            isVisible ? "transition-[height] motion-reduce:transition-none" : "",
            className
          )}
          style={{
            maxHeight: MOBILE_DRAWER_MAX_HEIGHT,
            height: contentHeight === null ? undefined : `min(${contentHeight}px, ${MOBILE_DRAWER_MAX_HEIGHT})`,
          }}
        >
          <div
            ref={contentRef}
            className="min-w-0 px-4 pt-3 pb-[max(2.75rem,calc(env(safe-area-inset-bottom)+1.25rem))]"
          >
            <div className="mb-3 flex justify-center" aria-hidden="true">
              <span className="h-1.5 w-12 rounded-full bg-border/80" />
            </div>
            <div className="min-h-0 pb-1">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
