"use client";

import { APP_VERSION } from "@/lib/appVersion";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/analytics/events";
import type { AnalyticsEvent, AnalyticsEventProperties } from "@/lib/analytics/types";

const ANALYTICS_ENDPOINT = "/api/analytics";
const ANALYTICS_SESSION_STORAGE_KEY = "spaceforge.analytics.session-id";
const ANALYTICS_LOAD_STARTED_AT_STORAGE_KEY = "spaceforge.analytics.load-started-at";
const ANALYTICS_TRACKED_EVENT_STORAGE_KEY_PREFIX = "spaceforge.analytics.tracked.";
const ANALYTICS_SESSION_SUMMARY_STORAGE_KEY = "spaceforge.analytics.session-summary";
const ANALYTICS_SESSION_SUMMARY_SENT_STORAGE_KEY = "spaceforge.analytics.session-summary-sent";

let fallbackSessionId: string | null = null;
let fallbackLoadStartedAtMs: number | null = null;
let fallbackSessionSummaryState: SessionSummaryState = createEmptySessionSummaryState();
let fallbackSessionSummarySent = false;
let hasRegisteredSessionSummaryListeners = false;

type SessionSummaryState = {
  roomsCreated: number;
  roomRenames: number;
  exportsStarted: number;
  exportsCompleted: number;
  settingsOpened: number;
  onboardingStarted: boolean;
  onboardingCompleted: boolean;
  firstActionOccurred: boolean;
  firstSuccessOccurred: boolean;
};

function createEmptySessionSummaryState(): SessionSummaryState {
  return {
    roomsCreated: 0,
    roomRenames: 0,
    exportsStarted: 0,
    exportsCompleted: 0,
    settingsOpened: 0,
    onboardingStarted: false,
    onboardingCompleted: false,
    firstActionOccurred: false,
    firstSuccessOccurred: false,
  };
}

function createAnalyticsSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getAnalyticsSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    fallbackSessionId ??= createAnalyticsSessionId();
    return fallbackSessionId;
  }

  const existingSessionId = sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);
  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createAnalyticsSessionId();
  sessionStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
}

function getTrackedEventStorageKey(event: AnalyticsEventName) {
  return `${ANALYTICS_TRACKED_EVENT_STORAGE_KEY_PREFIX}${event}`;
}

function getAnalyticsLoadStartedAtMs() {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    fallbackLoadStartedAtMs ??= Date.now();
    return fallbackLoadStartedAtMs;
  }

  const existingLoadStartedAt = sessionStorage.getItem(ANALYTICS_LOAD_STARTED_AT_STORAGE_KEY);
  if (existingLoadStartedAt) {
    const parsedLoadStartedAt = Number(existingLoadStartedAt);
    if (Number.isFinite(parsedLoadStartedAt) && parsedLoadStartedAt > 0) {
      return parsedLoadStartedAt;
    }
  }

  const nextLoadStartedAt = Date.now();
  sessionStorage.setItem(ANALYTICS_LOAD_STARTED_AT_STORAGE_KEY, String(nextLoadStartedAt));
  return nextLoadStartedAt;
}

function buildAnalyticsEvent(event: string, properties?: AnalyticsEventProperties): AnalyticsEvent {
  return {
    event,
    timestamp: new Date().toISOString(),
    sessionId: getAnalyticsSessionId(),
    route: window.location.pathname,
    version: APP_VERSION,
    source: "app",
    ...(properties ? { properties } : {}),
  };
}

function loadSessionSummaryState(): SessionSummaryState {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return fallbackSessionSummaryState;
  }

  const rawSummaryState = sessionStorage.getItem(ANALYTICS_SESSION_SUMMARY_STORAGE_KEY);
  if (!rawSummaryState) {
    return createEmptySessionSummaryState();
  }

  try {
    const parsedSummaryState = JSON.parse(rawSummaryState) as Partial<SessionSummaryState>;

    return {
      roomsCreated:
        typeof parsedSummaryState.roomsCreated === "number" ? parsedSummaryState.roomsCreated : 0,
      roomRenames:
        typeof parsedSummaryState.roomRenames === "number" ? parsedSummaryState.roomRenames : 0,
      exportsStarted:
        typeof parsedSummaryState.exportsStarted === "number" ? parsedSummaryState.exportsStarted : 0,
      exportsCompleted:
        typeof parsedSummaryState.exportsCompleted === "number"
          ? parsedSummaryState.exportsCompleted
          : 0,
      settingsOpened:
        typeof parsedSummaryState.settingsOpened === "number" ? parsedSummaryState.settingsOpened : 0,
      onboardingStarted: parsedSummaryState.onboardingStarted === true,
      onboardingCompleted: parsedSummaryState.onboardingCompleted === true,
      firstActionOccurred: parsedSummaryState.firstActionOccurred === true,
      firstSuccessOccurred: parsedSummaryState.firstSuccessOccurred === true,
    };
  } catch {
    return createEmptySessionSummaryState();
  }
}

function saveSessionSummaryState(state: SessionSummaryState) {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    fallbackSessionSummaryState = state;
    return;
  }

  sessionStorage.setItem(ANALYTICS_SESSION_SUMMARY_STORAGE_KEY, JSON.stringify(state));
}

function updateSessionSummaryState(event: string) {
  const currentState = loadSessionSummaryState();
  let nextState = currentState;

  switch (event) {
    case ANALYTICS_EVENTS.roomCreated:
      nextState = { ...currentState, roomsCreated: currentState.roomsCreated + 1 };
      break;
    case ANALYTICS_EVENTS.roomRenamed:
      nextState = { ...currentState, roomRenames: currentState.roomRenames + 1 };
      break;
    case ANALYTICS_EVENTS.exportStarted:
      nextState = { ...currentState, exportsStarted: currentState.exportsStarted + 1 };
      break;
    case ANALYTICS_EVENTS.exportCompleted:
      nextState = { ...currentState, exportsCompleted: currentState.exportsCompleted + 1 };
      break;
    case ANALYTICS_EVENTS.settingsOpened:
      nextState = { ...currentState, settingsOpened: currentState.settingsOpened + 1 };
      break;
    case ANALYTICS_EVENTS.onboardingStarted:
      nextState = { ...currentState, onboardingStarted: true };
      break;
    case ANALYTICS_EVENTS.onboardingCompleted:
      nextState = { ...currentState, onboardingCompleted: true };
      break;
    case ANALYTICS_EVENTS.firstAction:
      nextState = { ...currentState, firstActionOccurred: true };
      break;
    case ANALYTICS_EVENTS.firstSuccess:
      nextState = { ...currentState, firstSuccessOccurred: true };
      break;
    default:
      return;
  }

  saveSessionSummaryState(nextState);
}

function hasSentSessionSummary() {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return fallbackSessionSummarySent;
  }

  return sessionStorage.getItem(ANALYTICS_SESSION_SUMMARY_SENT_STORAGE_KEY) === "1";
}

function markSessionSummarySent() {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    fallbackSessionSummarySent = true;
    return;
  }

  sessionStorage.setItem(ANALYTICS_SESSION_SUMMARY_SENT_STORAGE_KEY, "1");
}

async function sendAnalyticsEvent(event: AnalyticsEvent) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const beaconBody = new Blob([JSON.stringify(event)], { type: "application/json" });
      if (navigator.sendBeacon(ANALYTICS_ENDPOINT, beaconBody)) {
        return;
      }
    }

    await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      cache: "no-store",
      keepalive: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Analytics event failed to send.", error);
    }
  }
}

export function track(event: string, properties?: AnalyticsEventProperties) {
  if (typeof window === "undefined") {
    return;
  }

  if (event !== ANALYTICS_EVENTS.sessionSummary) {
    updateSessionSummaryState(event);
  }

  void sendAnalyticsEvent(buildAnalyticsEvent(event, properties));
}

export function emitSessionSummary() {
  if (typeof window === "undefined" || hasSentSessionSummary()) {
    return false;
  }

  const summaryState = loadSessionSummaryState();
  const durationMs = getTimeSinceAnalyticsLoadMs();

  markSessionSummarySent();
  void sendAnalyticsEvent(
    buildAnalyticsEvent(ANALYTICS_EVENTS.sessionSummary, {
      durationMs,
      roomsCreated: summaryState.roomsCreated,
      roomRenames: summaryState.roomRenames,
      exportsStarted: summaryState.exportsStarted,
      exportsCompleted: summaryState.exportsCompleted,
      settingsOpened: summaryState.settingsOpened,
      onboardingStarted: summaryState.onboardingStarted,
      onboardingCompleted: summaryState.onboardingCompleted,
      firstActionOccurred: summaryState.firstActionOccurred,
      firstSuccessOccurred: summaryState.firstSuccessOccurred,
    })
  );
  return true;
}

export function setupSessionSummaryTracking() {
  if (typeof window === "undefined" || hasRegisteredSessionSummaryListeners) {
    return;
  }

  hasRegisteredSessionSummaryListeners = true;

  const emitOnSessionEnd = () => {
    emitSessionSummary();
  };

  const emitOnVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      emitSessionSummary();
    }
  };

  window.addEventListener("pagehide", emitOnSessionEnd);
  document.addEventListener("visibilitychange", emitOnVisibilityChange);
}

export function trackOncePerSession(
  event: AnalyticsEventName,
  properties?: AnalyticsEventProperties
) {
  if (typeof window === "undefined") {
    return false;
  }

  const sessionStorage = getSessionStorage();
  if (!sessionStorage) {
    return false;
  }

  const trackedEventStorageKey = getTrackedEventStorageKey(event);
  if (sessionStorage.getItem(trackedEventStorageKey) === "1") {
    return false;
  }

  sessionStorage.setItem(trackedEventStorageKey, "1");
  track(event, properties);
  return true;
}

export function getTimeSinceAnalyticsLoadMs() {
  if (typeof window === "undefined") {
    return 0;
  }

  return Math.max(0, Date.now() - getAnalyticsLoadStartedAtMs());
}

export function trackAppOpened() {
  getAnalyticsSessionId();
  getAnalyticsLoadStartedAtMs();
  setupSessionSummaryTracking();
  return trackOncePerSession(ANALYTICS_EVENTS.appOpened);
}

export function trackEditorLoaded() {
  getAnalyticsSessionId();
  return trackOncePerSession(ANALYTICS_EVENTS.editorLoaded);
}

export function trackFirstAction(action: "room_created" | "export_started") {
  return trackOncePerSession(ANALYTICS_EVENTS.firstAction, {
    action,
    timeSinceLoadMs: getTimeSinceAnalyticsLoadMs(),
  });
}

export function trackFirstSuccess(type: "room_created" | "export_completed") {
  return trackOncePerSession(ANALYTICS_EVENTS.firstSuccess, {
    type,
    timeSinceLoadMs: getTimeSinceAnalyticsLoadMs(),
  });
}
