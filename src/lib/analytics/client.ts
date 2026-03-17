"use client";

import { APP_VERSION } from "@/lib/appVersion";
import type { AnalyticsEvent, AnalyticsEventProperties } from "@/lib/analytics/types";

const ANALYTICS_ENDPOINT = "/api/analytics";
const ANALYTICS_SESSION_STORAGE_KEY = "spaceforge.analytics.session-id";

let fallbackSessionId: string | null = null;

function createAnalyticsSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionStorage() {
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
