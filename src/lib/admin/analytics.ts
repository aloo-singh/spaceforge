"server-only";

import { getSupabaseServerConfig } from "@/lib/supabase/server";

type AnalyticsEventRow = {
  event: string;
  timestamp: string;
  session_id: string;
  properties: Record<string, unknown> | null;
};

type FeedbackSubmissionRow = {
  created_at: string;
};

export type AnalyticsMetricCard = {
  label: string;
  value: string;
  detail: string;
};

export type FeedbackTrendPoint = {
  date: string;
  submissions: number;
};

export type AdminAnalyticsDashboardData = {
  metricCards: AnalyticsMetricCard[];
  feedbackTrend: FeedbackTrendPoint[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SESSION_WINDOW_DAYS = 30;
const SESSION_AVERAGE_DAYS = 7;
const FEEDBACK_TREND_DAYS = 30;

function assertSupabaseConfig() {
  const config = getSupabaseServerConfig();
  if (!config) {
    throw new Error("Missing Supabase server configuration.");
  }

  return config;
}

async function supabaseRequest(pathname: string, init: RequestInit) {
  const config = assertSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase analytics request failed: ${response.status} ${errorText}`);
  }

  return response;
}

function getUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateDaysAgo(daysAgo: number) {
  return new Date(Date.now() - daysAgo * MS_PER_DAY);
}

function getDateSeries(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const daysAgo = days - index - 1;
    return getUtcDateKey(getDateDaysAgo(daysAgo));
  });
}

function parseExactCount(response: Response) {
  const contentRange = response.headers.get("content-range");
  const totalCount = contentRange?.split("/")[1];
  if (!totalCount) {
    return 0;
  }

  const parsedCount = Number.parseInt(totalCount, 10);
  return Number.isFinite(parsedCount) ? parsedCount : 0;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null || !Number.isFinite(durationMs)) {
    return "No data";
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function getPropertyNumber(properties: Record<string, unknown> | null, key: string) {
  const value = properties?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPropertyString(properties: Record<string, unknown> | null, key: string) {
  const value = properties?.[key];
  return typeof value === "string" ? value : null;
}

async function fetchRecentAnalyticsEvents(sinceIso: string) {
  const query = new URLSearchParams({
    select: "event,timestamp,session_id,properties",
    event: "in.(app_opened,room_created,first_success)",
    timestamp: `gte.${sinceIso}`,
    order: "timestamp.asc",
  });

  const response = await supabaseRequest(`analytics_events?${query.toString()}`, {
    method: "GET",
  });

  return (await response.json()) as AnalyticsEventRow[];
}

async function fetchTotalRoomsCreated() {
  const query = new URLSearchParams({
    select: "id",
    event: "eq.room_created",
    limit: "1",
  });

  const response = await supabaseRequest(`analytics_events?${query.toString()}`, {
    method: "GET",
    headers: {
      Prefer: "count=exact",
    },
  });

  return parseExactCount(response);
}

async function fetchRecentFeedbackSubmissions(sinceIso: string) {
  const query = new URLSearchParams({
    select: "created_at",
    created_at: `gte.${sinceIso}`,
    order: "created_at.asc",
  });

  const response = await supabaseRequest(`feedback_submissions?${query.toString()}`, {
    method: "GET",
  });

  return (await response.json()) as FeedbackSubmissionRow[];
}

function buildFeedbackTrend(rows: FeedbackSubmissionRow[]) {
  const dateSeries = getDateSeries(FEEDBACK_TREND_DAYS);
  const counts = new Map(dateSeries.map((date) => [date, 0]));

  for (const row of rows) {
    const dateKey = row.created_at.slice(0, 10);
    if (!counts.has(dateKey)) {
      continue;
    }

    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  }

  return dateSeries.map((date) => ({
    date,
    submissions: counts.get(date) ?? 0,
  }));
}

function buildMetricCards(events: AnalyticsEventRow[], totalRoomsCreated: number): AnalyticsMetricCard[] {
  const sessionAverageDates = new Set(getDateSeries(SESSION_AVERAGE_DAYS));
  const sessionsPerDay = new Map<string, Set<string>>();
  const openedSessions = new Set<string>();
  const drawnSessions = new Set<string>();
  const firstRoomDurations = new Map<string, number>();
  const openedAtBySession = new Map<string, number>();
  const firstRoomAtBySession = new Map<string, number>();

  for (const date of sessionAverageDates) {
    sessionsPerDay.set(date, new Set<string>());
  }

  for (const event of events) {
    const timestampMs = Date.parse(event.timestamp);
    if (Number.isNaN(timestampMs)) {
      continue;
    }

    const dateKey = event.timestamp.slice(0, 10);

    if (event.event === "app_opened") {
      openedSessions.add(event.session_id);
      if (sessionAverageDates.has(dateKey)) {
        sessionsPerDay.get(dateKey)?.add(event.session_id);
      }

      const existingOpenedAt = openedAtBySession.get(event.session_id);
      if (existingOpenedAt === undefined || timestampMs < existingOpenedAt) {
        openedAtBySession.set(event.session_id, timestampMs);
      }
    }

    if (event.event === "room_created") {
      drawnSessions.add(event.session_id);
      const existingFirstRoomAt = firstRoomAtBySession.get(event.session_id);
      if (existingFirstRoomAt === undefined || timestampMs < existingFirstRoomAt) {
        firstRoomAtBySession.set(event.session_id, timestampMs);
      }
    }

    if (event.event === "first_success") {
      const eventType = getPropertyString(event.properties, "type");
      const timeSinceLoadMs = getPropertyNumber(event.properties, "timeSinceLoadMs");
      if (eventType === "room_created" && timeSinceLoadMs !== null) {
        firstRoomDurations.set(event.session_id, timeSinceLoadMs);
      }
    }
  }

  for (const [sessionId, roomCreatedAt] of firstRoomAtBySession) {
    if (firstRoomDurations.has(sessionId)) {
      continue;
    }

    const openedAt = openedAtBySession.get(sessionId);
    if (openedAt === undefined || roomCreatedAt < openedAt) {
      continue;
    }

    firstRoomDurations.set(sessionId, roomCreatedAt - openedAt);
  }

  const sessionCountTotal = Array.from(sessionsPerDay.values()).reduce(
    (total, sessionIds) => total + sessionIds.size,
    0
  );
  const sessionAverage = sessionCountTotal / SESSION_AVERAGE_DAYS;
  const drawRate =
    openedSessions.size === 0 ? 0 : drawnSessions.size / Math.max(1, openedSessions.size);
  const firstRoomDurationValues = Array.from(firstRoomDurations.values());
  const averageFirstRoomDuration =
    firstRoomDurationValues.length === 0
      ? null
      : firstRoomDurationValues.reduce((total, value) => total + value, 0) /
        firstRoomDurationValues.length;

  return [
    {
      label: "Sessions per day",
      value: formatInteger(sessionAverage),
      detail: `Average daily sessions over the last ${SESSION_AVERAGE_DAYS} days`,
    },
    {
      label: "% drawing at least one room",
      value: formatPercent(drawRate),
      detail: `Share of sessions with at least one room over the last ${SESSION_WINDOW_DAYS} days`,
    },
    {
      label: "Average time to first room",
      value: formatDuration(averageFirstRoomDuration),
      detail: `Measured from session start over the last ${SESSION_WINDOW_DAYS} days`,
    },
    {
      label: "Total rooms created",
      value: formatInteger(totalRoomsCreated),
      detail: "All tracked room creation events across all time",
    },
  ];
}

export async function fetchAdminAnalyticsDashboardData(): Promise<AdminAnalyticsDashboardData> {
  const analyticsSinceIso = getDateDaysAgo(SESSION_WINDOW_DAYS - 1).toISOString();
  const feedbackSinceIso = getDateDaysAgo(FEEDBACK_TREND_DAYS - 1).toISOString();

  const [recentAnalyticsEvents, totalRoomsCreated, recentFeedbackSubmissions] = await Promise.all([
    fetchRecentAnalyticsEvents(analyticsSinceIso),
    fetchTotalRoomsCreated(),
    fetchRecentFeedbackSubmissions(feedbackSinceIso),
  ]);

  return {
    metricCards: buildMetricCards(recentAnalyticsEvents, totalRoomsCreated),
    feedbackTrend: buildFeedbackTrend(recentFeedbackSubmissions),
  };
}
