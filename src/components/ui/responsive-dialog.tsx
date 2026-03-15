"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
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
}: ResponsiveDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fallbackContentId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const resolvedContentId = contentId ?? fallbackContentId;

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

  useEffect(() => {
    if (!open) return;

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusPanel = () => {
      const panelElement = panelRef.current;
      if (!panelElement) return;

      const firstFocusableElement = getFocusableElements(panelElement)[0];
      if (firstFocusableElement) {
        firstFocusableElement.focus();
        return;
      }

      panelElement.focus();
    };

    const focusFrame = window.requestAnimationFrame(focusPanel);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab") return;
      const panelElement = panelRef.current;
      if (!panelElement) return;

      const focusableElements = getFocusableElements(panelElement);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panelElement.focus();
        return;
      }

      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocusedElementRef.current?.focus();
      previouslyFocusedElementRef.current = null;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]",
        isMobile ? "flex items-end justify-stretch" : "flex items-center justify-center p-4"
      )}
      onClick={() => onOpenChange(false)}
    >
      <div
        id={resolvedContentId}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-surface={isMobile ? "drawer" : "dialog"}
        className={cn(
          "border border-border/70 bg-card text-card-foreground shadow-xl outline-none overflow-y-auto",
          isMobile
            ? "w-full max-h-[min(85vh,calc(100vh-0.75rem))] rounded-t-2xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "w-[min(100%,28rem)] max-h-[calc(100vh-2rem)] rounded-xl p-5",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {isMobile ? (
          <div className="mb-3 flex justify-center" aria-hidden="true">
            <span className="h-1.5 w-12 rounded-full bg-border/80" />
          </div>
        ) : null}
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
        {footer ? (
          <div className={cn("mt-6 flex gap-2", isMobile ? "flex-col-reverse" : "justify-end")}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
