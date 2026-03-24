"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, MessageSquare, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { submitFeedback } from "@/lib/feedback/client";
import {
  FEEDBACK_PROMPT_VARIANT,
  type FeedbackMetadata,
  type FeedbackPageContext,
  type FeedbackSentiment,
  type FeedbackSource,
} from "@/lib/feedback/types";
import { getOrCreateAnonymousClientToken } from "@/lib/projects/clientIdentity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Keycap } from "@/components/ui/keycap";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { detectMacPlatform } from "@/lib/platform";
import { useMobile } from "@/lib/use-mobile";
import { cn } from "@/lib/utils";

const FEEDBACK_PROMPT_DELAY_MS = 45_000;
const FEEDBACK_ENTER_DURATION_MS = 320;
const FEEDBACK_EXIT_DURATION_MS = 180;
const FEEDBACK_HEIGHT_TRANSITION_MS = 260;

type FeedbackViewState = {
  activeSource: FeedbackSource | null;
  sentiment: FeedbackSentiment | null;
  freeText: string;
  status: "idle" | "submitting" | "submitted";
  errorMessage: string | null;
};

type FeedbackPromptSessionState = {
  autoOpened: boolean;
  dismissed: boolean;
  submitted: boolean;
};

type FeedbackWidgetProps = {
  pageContext: FeedbackPageContext;
  projectId?: string | null;
  promptEligible?: boolean;
  promptVariant?: string | null;
  surface?: "light" | "dark";
  getMetadata?: () => FeedbackMetadata | null;
};

type FeedbackPanelContentProps = {
  canSubmit: boolean;
  errorMessage: string | null;
  freeText: string;
  isMacPlatform: boolean;
  isDarkSurface: boolean;
  isSubmitModifierHeld: boolean;
  onClose: () => void;
  onFreeTextChange: (value: string) => void;
  onGoBack: () => void;
  onSelectSentiment: (nextSentiment: FeedbackSentiment) => void;
  onSubmit: () => void;
  sentiment: FeedbackSentiment | null;
  status: FeedbackViewState["status"];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

type AnimatedFeedbackBodyProps = {
  active: boolean;
  children: React.ReactNode;
};

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

function getPromptStateStorageKey(pageContext: FeedbackPageContext) {
  return `spaceforge.feedback.${pageContext}.prompt`;
}

function loadPromptSessionState(pageContext: FeedbackPageContext): FeedbackPromptSessionState {
  const storage = getSessionStorage();
  if (!storage) {
    return { autoOpened: false, dismissed: false, submitted: false };
  }

  const rawValue = storage.getItem(getPromptStateStorageKey(pageContext));
  if (!rawValue) {
    return { autoOpened: false, dismissed: false, submitted: false };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<FeedbackPromptSessionState>;
    return {
      autoOpened: parsed.autoOpened === true,
      dismissed: parsed.dismissed === true,
      submitted: parsed.submitted === true,
    };
  } catch {
    return { autoOpened: false, dismissed: false, submitted: false };
  }
}

function savePromptSessionState(
  pageContext: FeedbackPageContext,
  nextState: FeedbackPromptSessionState
) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(getPromptStateStorageKey(pageContext), JSON.stringify(nextState));
}

function createInitialViewState(): FeedbackViewState {
  return {
    activeSource: null,
    sentiment: null,
    freeText: "",
    status: "idle",
    errorMessage: null,
  };
}

function FeedbackPanelContent({
  canSubmit,
  errorMessage,
  freeText,
  isMacPlatform,
  isDarkSurface,
  isSubmitModifierHeld,
  onClose,
  onFreeTextChange,
  onGoBack,
  onSelectSentiment,
  onSubmit,
  sentiment,
  status,
  textareaRef,
}: FeedbackPanelContentProps) {
  const submitShortcutLabel = isMacPlatform ? "⌘↩" : "Ctrl↩";
  const isSubmitting = status === "submitting";

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p
            className={cn(
              "font-measurement text-[11px] font-semibold tracking-[0.18em] uppercase",
              isDarkSurface ? "text-white/50" : "text-foreground/45"
            )}
          >
            Quick 2-question check...
          </p>
          {status === "submitted" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={cn(
                    "size-4 transition-all duration-200",
                    isDarkSurface ? "text-emerald-300" : "text-emerald-600"
                  )}
                />
                <p className="text-sm font-medium">Thanks. That genuinely helps.</p>
              </div>
              <p className={cn("text-sm leading-6", isDarkSurface ? "text-white/68" : "text-muted-foreground")}>
                You can leave another note anytime from the feedback button.
              </p>
            </div>
          ) : sentiment === null ? (
            <div className="space-y-2">
              <p className="text-sm font-medium leading-6">Was that easier than you expected?</p>
              <p className={cn("text-sm leading-6", isDarkSurface ? "text-white/68" : "text-muted-foreground")}>
                Small gut check, nothing formal.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium leading-6">
                {sentiment === "positive" ? "Nice. What made it feel easy?" : "What slowed you down?"}
              </p>
              <p className={cn("text-sm leading-6", isDarkSurface ? "text-white/68" : "text-muted-foreground")}>
                A short note is enough.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={status === "submitting"}
          className={cn(
            "shrink-0 rounded-full p-1.5 transition-[transform,colors] duration-75 ease-out active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:active:scale-100",
            isDarkSurface ? "text-white/56 hover:bg-white/10 hover:text-white" : "text-foreground/48 hover:bg-muted hover:text-foreground"
          )}
          aria-label="Close feedback"
        >
          <X className="size-4" />
        </button>
      </div>

      {status === "submitted" ? (
        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className={cn(isDarkSurface ? "border-white/14 bg-transparent text-white hover:bg-white/8" : "")}
          >
            Close
          </Button>
        </div>
      ) : sentiment === null ? (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onSelectSentiment("positive")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-[transform,colors] duration-75 ease-out active:scale-[0.97]",
              isDarkSurface
                ? "border-white/12 bg-white/6 text-white hover:bg-white/10"
                : "border-border/70 bg-card/70 text-foreground hover:bg-muted/70"
            )}
          >
            <ThumbsUp className="size-4" />
            Yes
          </button>
          <button
            type="button"
            onClick={() => onSelectSentiment("negative")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-[transform,colors] duration-75 ease-out active:scale-[0.97]",
              isDarkSurface
                ? "border-white/12 bg-white/6 text-white hover:bg-white/10"
                : "border-border/70 bg-card/70 text-foreground hover:bg-muted/70"
            )}
          >
            <ThumbsDown className="size-4" />
            Not really
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-3.5">
          <textarea
            ref={textareaRef}
            autoFocus
            value={freeText}
            onChange={(event) => onFreeTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || isSubmitting) return;

              const isSubmitShortcut = isMacPlatform
                ? event.metaKey && !event.ctrlKey && !event.altKey && event.key === "Enter"
                : event.ctrlKey && !event.metaKey && !event.altKey && event.key === "Enter";

              if (isSubmitShortcut && canSubmit) {
                event.preventDefault();
                event.stopPropagation();
                onSubmit();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onGoBack();
              }
            }}
            rows={4}
            placeholder={
              sentiment === "positive"
                ? "What felt smooth or clear?"
                : "What felt awkward, slow, or unclear?"
            }
            className={cn(
              "w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition-colors",
              "focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/15",
              isDarkSurface
                ? "border-white/12 bg-white/6 text-white placeholder:text-white/36"
                : "border-border/70 bg-background text-foreground placeholder:text-muted-foreground"
            )}
          />

          {errorMessage ? (
            <p className={cn("text-sm", isDarkSurface ? "text-red-300" : "text-red-600")}>
              {errorMessage}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onGoBack}
              disabled={status === "submitting"}
              className={cn(isDarkSurface ? "text-white/72 hover:bg-white/10 hover:text-white" : "")}
            >
              <span>Back</span>
              <Keycap aria-hidden="true" className="ml-1 border-current/20 bg-transparent text-current/70 shadow-none">
                Esc
              </Keycap>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="gap-1 px-2 pr-1 bg-blue-500 text-white hover:bg-blue-500/90"
            >
              {status === "submitting" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span>{status === "submitting" ? "Sending..." : "Send"}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid transition-[grid-template-columns,opacity,transform] duration-150 ease-out",
                  isSubmitModifierHeld
                    ? "grid-cols-[1fr] opacity-100 translate-x-0"
                    : "grid-cols-[0fr] opacity-0 translate-x-1"
                )}
              >
                <Keycap
                  className="h-5 min-w-0 overflow-hidden rounded-sm border-white/18 bg-white/12 px-1 text-[10px] text-white/86 shadow-none"
                >
                  {submitShortcutLabel}
                </Keycap>
              </span>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function AnimatedFeedbackBody({ active, children }: AnimatedFeedbackBodyProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    const contentElement = contentRef.current;
    if (!contentElement) {
      return;
    }

    const updateHeight = () => {
      setHeight(Math.ceil(contentElement.getBoundingClientRect().height));
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [active, children]);

  return (
    <div
      className={cn(
        active &&
          "overflow-hidden transition-[height] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      )}
      style={
        active && height !== null
          ? {
              height,
              transitionDuration: `${FEEDBACK_HEIGHT_TRANSITION_MS}ms`,
            }
          : undefined
      }
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

export function FeedbackWidget({
  pageContext,
  projectId = null,
  promptEligible = false,
  promptVariant = FEEDBACK_PROMPT_VARIANT,
  surface = "light",
  getMetadata,
}: FeedbackWidgetProps) {
  const [openedAtMs] = useState(() => Date.now());
  const isOpenRef = useRef(false);
  const promptTimerRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const openTimeoutRef = useRef<number | null>(null);
  const desktopPanelRef = useRef<HTMLDivElement | null>(null);
  const desktopPanelAnimationRef = useRef<Animation | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const [panelState, setPanelState] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [viewState, setViewState] = useState<FeedbackViewState>(() => createInitialViewState());
  const [promptSessionState, setPromptSessionState] = useState<FeedbackPromptSessionState>(() =>
    loadPromptSessionState(pageContext)
  );
  const [isMacPlatform, setIsMacPlatform] = useState(false);
  const [isSubmitModifierHeld, setIsSubmitModifierHeld] = useState(false);
  const { isMobile, isReady: isMobileReady } = useMobile();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isOpen = panelState === "opening" || panelState === "open" || panelState === "closing";
  const activeSource = viewState.activeSource;
  const sentiment = viewState.sentiment;
  const freeText = viewState.freeText;
  const status = viewState.status;
  const errorMessage = viewState.errorMessage;

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (promptTimerRef.current !== null) {
        window.clearTimeout(promptTimerRef.current);
      }
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      if (openTimeoutRef.current !== null) {
        window.clearTimeout(openTimeoutRef.current);
      }
      desktopPanelAnimationRef.current?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    setIsMacPlatform(detectMacPlatform());
  }, []);

  useEffect(() => {
    if (sentiment === null || status === "submitted") {
      setIsSubmitModifierHeld(false);
    }
  }, [sentiment, status]);

  useEffect(() => {
    if (sentiment === null || status === "submitted") {
      return;
    }

    textareaRef.current?.focus();
  }, [sentiment, status]);

  const beginPanelOpen = useCallback(() => {
    desktopPanelAnimationRef.current?.cancel();
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }

    setPanelState("opening");
    if (isMobile) {
      openTimeoutRef.current = window.setTimeout(() => {
        setPanelState("open");
        openTimeoutRef.current = null;
      }, FEEDBACK_ENTER_DURATION_MS);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!promptEligible || promptSessionState.autoOpened || isOpen) {
      return;
    }

    const elapsedMs = Date.now() - openedAtMs;
    const remainingDelayMs = Math.max(FEEDBACK_PROMPT_DELAY_MS - elapsedMs, 0);
    promptTimerRef.current = window.setTimeout(() => {
      if (isOpenRef.current) {
        return;
      }

      setPromptSessionState((currentState) => {
        if (currentState.autoOpened) {
          return currentState;
        }

        const nextState = {
          ...currentState,
          autoOpened: true,
        };
        savePromptSessionState(pageContext, nextState);
        return nextState;
      });

      setViewState({
        activeSource: "prompt",
        sentiment: null,
        freeText: "",
        errorMessage: null,
        status: "idle",
      });
      beginPanelOpen();
    }, remainingDelayMs);

    return () => {
      if (promptTimerRef.current !== null) {
        window.clearTimeout(promptTimerRef.current);
        promptTimerRef.current = null;
      }
    };
  }, [beginPanelOpen, isOpen, openedAtMs, pageContext, promptEligible, promptSessionState.autoOpened]);

  const isPromptSurface = activeSource === "prompt";
  const isDarkSurface = surface === "dark";
  const canSubmit = freeText.trim().length > 0 && sentiment !== null && status !== "submitting";
  const isPanelVisible = panelState !== "closed";
  const closePanel = useCallback(() => {
    if (status === "submitting") {
      return;
    }

    if (activeSource === "prompt" && status !== "submitted") {
      const nextState = {
        ...promptSessionState,
        dismissed: true,
      };
      setPromptSessionState(nextState);
      savePromptSessionState(pageContext, nextState);
    }

    desktopPanelAnimationRef.current?.cancel();
    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    setPanelState("closing");
    if (isMobile) {
      closeTimeoutRef.current = window.setTimeout(() => {
        setPanelState("closed");
        setViewState(createInitialViewState());
        closeTimeoutRef.current = null;
      }, FEEDBACK_EXIT_DURATION_MS);
    }
  }, [activeSource, isMobile, pageContext, promptSessionState, status]);

  const handleMobileDrawerOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        closePanel();
      }
    },
    [closePanel]
  );

  useEffect(() => {
    if (isMobile || !desktopPanelRef.current) {
      return;
    }

    const panelElement = desktopPanelRef.current;
    desktopPanelAnimationRef.current?.cancel();

    if (panelState === "opening") {
      desktopPanelAnimationRef.current = panelElement.animate(
        isPromptSurface
          ? [
              {
                transform: "translateX(calc(100% + 1.5rem)) scale(0.985)",
                opacity: 1,
              },
              {
                transform: "translateX(0) scale(1)",
                opacity: 1,
              },
            ]
          : [
              {
                transform: "translateY(0.75rem) scale(0.985)",
                opacity: 0,
              },
              {
                transform: "translateY(0) scale(1)",
                opacity: 1,
              },
            ],
        {
          duration: FEEDBACK_ENTER_DURATION_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        }
      );
      desktopPanelAnimationRef.current.onfinish = () => {
        setPanelState("open");
        desktopPanelAnimationRef.current = null;
      };
      return;
    }

    if (panelState === "closing") {
      desktopPanelAnimationRef.current = panelElement.animate(
        isPromptSurface
          ? [
              {
                transform: "translateX(0) scale(1)",
                opacity: 1,
              },
              {
                transform: "translateX(calc(100% + 1.5rem)) scale(0.99)",
                opacity: 1,
              },
            ]
          : [
              {
                transform: "translateY(0) scale(1)",
                opacity: 1,
              },
              {
                transform: "translateY(0.5rem) scale(0.985)",
                opacity: 0,
              },
            ],
        {
          duration: FEEDBACK_EXIT_DURATION_MS,
          easing: "cubic-bezier(0.4, 0, 1, 1)",
          fill: "forwards",
        }
      );
      desktopPanelAnimationRef.current.onfinish = () => {
        setPanelState("closed");
        setViewState(createInitialViewState());
        desktopPanelAnimationRef.current = null;
      };
    }
  }, [isMobile, isPromptSurface, panelState]);

  const openManualFlow = () => {
    if (status === "submitting") {
      return;
    }

    if (isOpen && activeSource === "manual_button") {
      closePanel();
      return;
    }

    setViewState({
      activeSource: "manual_button",
      sentiment: null,
      freeText: "",
      errorMessage: null,
      status: "idle",
    });
    beginPanelOpen();
  };

  const handleSubmit = async () => {
    if (!canSubmit || sentiment === null || activeSource === null) {
      return;
    }

    try {
      setViewState((currentState) => ({
        ...currentState,
        status: "submitting",
        errorMessage: null,
      }));
      await submitFeedback({
        clientToken: getOrCreateAnonymousClientToken(),
        projectId,
        pageContext,
        source: activeSource,
        sentiment,
        freeText: freeText.trim(),
        timeSinceOpenSeconds: (Date.now() - openedAtMs) / 1000,
        promptVariant,
        metadata: getMetadata?.() ?? null,
      });

      if (activeSource === "prompt") {
        const nextState = {
          ...promptSessionState,
          submitted: true,
        };
        setPromptSessionState(nextState);
        savePromptSessionState(pageContext, nextState);
      }

      setViewState((currentState) => ({
        ...currentState,
        status: "submitted",
      }));
    } catch (error) {
      setViewState((currentState) => ({
        ...currentState,
        status: "idle",
        errorMessage: error instanceof Error ? error.message : "Could not send feedback just now.",
      }));
    }
  };

  const handleGoBack = useCallback(() => {
    setViewState((currentState) => ({
      ...currentState,
      sentiment: null,
      freeText: "",
      errorMessage: null,
    }));
  }, []);

  useEffect(() => {
    if (!isPanelVisible) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.key !== "Escape") {
        return;
      }

      if (status === "submitting") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (status === "submitted" || sentiment === null) {
        closePanel();
        return;
      }

      handleGoBack();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, handleGoBack, isPanelVisible, sentiment, status]);

  useEffect(() => {
    if (!isPanelVisible || sentiment === null || status === "submitted") {
      return;
    }

    const syncModifierState = (event: KeyboardEvent) => {
      setIsSubmitModifierHeld(isMacPlatform ? event.metaKey : event.ctrlKey);
    };

    const clearModifierState = () => {
      setIsSubmitModifierHeld(false);
    };

    window.addEventListener("keydown", syncModifierState);
    window.addEventListener("keyup", syncModifierState);
    window.addEventListener("blur", clearModifierState);
    document.addEventListener("visibilitychange", clearModifierState);

    return () => {
      window.removeEventListener("keydown", syncModifierState);
      window.removeEventListener("keyup", syncModifierState);
      window.removeEventListener("blur", clearModifierState);
      document.removeEventListener("visibilitychange", clearModifierState);
    };
  }, [isMacPlatform, isPanelVisible, sentiment, status]);

  const panelContent = (
    <AnimatedFeedbackBody active={isPanelVisible}>
      <FeedbackPanelContent
        canSubmit={canSubmit}
        errorMessage={errorMessage}
        freeText={freeText}
        isMacPlatform={isMacPlatform}
        isDarkSurface={isDarkSurface}
        isSubmitModifierHeld={isSubmitModifierHeld}
        onClose={closePanel}
        onFreeTextChange={(nextFreeText) =>
          setViewState((currentState) => ({
            ...currentState,
            freeText: nextFreeText,
          }))
        }
        onGoBack={handleGoBack}
        onSelectSentiment={(nextSentiment) =>
          setViewState((currentState) => ({
            ...currentState,
            sentiment: nextSentiment,
          }))
        }
        onSubmit={() => {
          void handleSubmit();
        }}
        sentiment={sentiment}
        status={status}
        textareaRef={textareaRef}
      />
    </AnimatedFeedbackBody>
  );
  const desktopPanelStyle =
    panelState === "opening"
      ? isPromptSurface
        ? { transform: "translateX(calc(100% + 1.5rem)) scale(0.985)", opacity: 1 }
        : { transform: "translateY(0.75rem) scale(0.985)", opacity: 0 }
      : panelState === "open"
        ? { transform: "translateX(0) translateY(0) scale(1)", opacity: 1 }
        : panelState === "closing"
          ? { transform: "translateX(0) translateY(0) scale(1)", opacity: 1 }
          : isPromptSurface
            ? { transform: "translateX(calc(100% + 1.5rem)) scale(0.985)", opacity: 1 }
            : { transform: "translateY(0.75rem) scale(0.985)", opacity: 0 };

  return (
    <>
      <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
        {isMobileReady && !isMobile ? (
          <Card
            ref={desktopPanelRef}
            style={desktopPanelStyle}
            className={cn(
              "pointer-events-auto w-[min(22rem,calc(100vw-2rem))] origin-bottom-right backdrop-blur",
              isPanelVisible ? "" : "pointer-events-none",
              isDarkSurface
                ? "border-white/12 bg-black/72 text-white shadow-black/30"
                : "border-border/70 bg-background/92 text-foreground shadow-black/8",
              isPromptSurface && status !== "submitted" ? "ring-1 ring-blue-500/20" : ""
            )}
            aria-hidden={!isPanelVisible}
          >
            <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
              {panelContent}
            </CardContent>
          </Card>
        ) : null}

        <button
          type="button"
          onClick={openManualFlow}
          className={cn(
            "pointer-events-auto inline-flex size-12 shrink-0 items-center justify-center rounded-full border shadow-lg transition-[colors,box-shadow,opacity,transform] duration-75 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
            isDarkSurface
              ? "border-white/12 bg-black/72 text-white hover:bg-black/82"
              : "border-border/70 bg-background/94 text-foreground hover:bg-background",
            isMobileReady && isMobile && isPanelVisible ? "pointer-events-none opacity-0" : "opacity-100"
          )}
          aria-label="Open feedback"
        >
          <MessageSquare className="size-5" />
        </button>
      </div>

      <ResponsiveDialog
        open={isMobile && isPanelVisible}
        onOpenChange={handleMobileDrawerOpenChange}
        title="Feedback"
        hideHeader
        surfaceOverride="drawer"
        motionState={panelState === "closed" ? undefined : panelState}
        panelRef={mobileDrawerRef}
        className={cn(
          "rounded-t-3xl border shadow-xl",
          isDarkSurface
            ? "border-white/12 bg-neutral-950 text-white"
            : "border-border/70 bg-card text-card-foreground"
        )}
      >
        {panelContent}
      </ResponsiveDialog>
    </>
  );
}
