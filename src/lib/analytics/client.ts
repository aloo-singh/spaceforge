"use client";

import { APP_VERSION } from "@/lib/appVersion";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/analytics/events";
import type { AnalyticsEvent, AnalyticsEventProperties } from "@/lib/analytics/types";

const ANALYTICS_ENDPOINT = "/api/analytics";
const ANALYTICS_SESSION_STORAGE_KEY = "spaceforge.analytics.session-id";
const ANALYTICS_LOAD_STARTED_AT_STORAGE_KEY = "spaceforge.analytics.load-started-at";
const ANALYTICS_TRACKED_EVENT_STORAGE_KEY_PREFIX = "spaceforge.analytics.tracked.";

let fallbackSessionId: string | null = null;
let fallbackLoadStartedAtMs: number | null = null;

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

  void sendAnalyticsEvent(buildAnalyticsEvent(event, properties));
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
  return trackOncePerSession(ANALYTICS_EVENTS.appOpened);
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
