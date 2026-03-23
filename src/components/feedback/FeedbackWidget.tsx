"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

const FEEDBACK_PROMPT_DELAY_MS = 45_000;

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
  const [isOpen, setIsOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<FeedbackSource | null>(null);
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);
  const [freeText, setFreeText] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [promptSessionState, setPromptSessionState] = useState<FeedbackPromptSessionState>(() =>
    loadPromptSessionState(pageContext)
  );

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

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
      setActiveSource("prompt");
      setSentiment(null);
      setFreeText("");
      setErrorMessage(null);
      setStatus("idle");
      setIsOpen(true);
    }, remainingDelayMs);

    return () => {
      if (promptTimerRef.current !== null) {
        window.clearTimeout(promptTimerRef.current);
        promptTimerRef.current = null;
      }
    };
  }, [isOpen, openedAtMs, pageContext, promptEligible, promptSessionState.autoOpened]);

  const isPromptSurface = activeSource === "prompt";
  const isDarkSurface = surface === "dark";
  const canSubmit = freeText.trim().length > 0 && sentiment !== null && status !== "submitting";

  const resetFlow = () => {
    setSentiment(null);
    setFreeText("");
    setErrorMessage(null);
    setStatus("idle");
  };

  const closePanel = () => {
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

    setIsOpen(false);
    setActiveSource(null);
    resetFlow();
  };

  const openManualFlow = () => {
    if (status === "submitting") {
      return;
    }

    if (isOpen && activeSource === "manual_button") {
      closePanel();
      return;
    }

    setActiveSource("manual_button");
    setIsOpen(true);
    resetFlow();
  };

  const handleSubmit = async () => {
    if (!canSubmit || sentiment === null || activeSource === null) {
      return;
    }

    try {
      setStatus("submitting");
      setErrorMessage(null);
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
      setStatus("submitted");
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Could not send feedback just now.");
    }
  };

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      <div
        className={cn(
          "pointer-events-auto w-full origin-bottom-right rounded-2xl border px-4 py-4 shadow-lg backdrop-blur transition-all duration-200",
          isOpen
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-[0.98] opacity-0",
          isDarkSurface
            ? "border-white/12 bg-black/72 text-white shadow-black/30"
            : "border-border/70 bg-background/92 text-foreground shadow-black/8",
          isPromptSurface && status !== "submitted" ? "ring-1 ring-blue-500/20" : ""
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p
              className={cn(
                "font-measurement text-[11px] font-semibold tracking-[0.18em] uppercase",
                isDarkSurface ? "text-white/50" : "text-foreground/45"
              )}
            >
              Quick 2-question check...
            </p>
            {status === "submitted" ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">Thanks. That helps.</p>
                <p className={cn("text-sm leading-6", isDarkSurface ? "text-white/68" : "text-muted-foreground")}>
                  You can reopen this anytime from the feedback button.
                </p>
              </div>
            ) : sentiment === null ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">Was that easier than you expected?</p>
                <p className={cn("text-sm leading-6", isDarkSurface ? "text-white/68" : "text-muted-foreground")}>
                  Small gut check, nothing formal.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">
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
            onClick={closePanel}
            disabled={status === "submitting"}
            className={cn(
              "rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              isDarkSurface ? "text-white/56 hover:bg-white/10 hover:text-white" : "text-foreground/48 hover:bg-muted hover:text-foreground"
            )}
            aria-label="Close feedback"
          >
            <X className="size-4" />
          </button>
        </div>

        {status === "submitted" ? (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closePanel}
              className={cn(
                isDarkSurface ? "border-white/14 bg-transparent text-white hover:bg-white/8" : ""
              )}
            >
              Close
            </Button>
          </div>
        ) : sentiment === null ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSentiment("positive")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
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
              onClick={() => setSentiment("negative")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
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
          <div className="mt-4 space-y-3">
            <textarea
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
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
                onClick={() => {
                  setSentiment(null);
                  setFreeText("");
                  setErrorMessage(null);
                }}
                disabled={status === "submitting"}
                className={cn(isDarkSurface ? "text-white/72 hover:bg-white/10 hover:text-white" : "")}
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void handleSubmit();
                }}
                disabled={!canSubmit}
                className="bg-blue-500 text-white hover:bg-blue-500/90"
              >
                <Send className="size-4" />
                {status === "submitting" ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openManualFlow}
        className={cn(
          "pointer-events-auto flex size-12 items-center justify-center rounded-full border shadow-lg transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
          isDarkSurface
            ? "border-white/12 bg-black/72 text-white hover:bg-black/82"
            : "border-border/70 bg-background/94 text-foreground hover:bg-background"
        )}
        aria-label="Open feedback"
      >
        <MessageSquare className="size-5" />
      </button>
    </div>
  );
}
