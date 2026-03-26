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
  slug: AnalyticsMetricSlug;
  href: string;
  label: string;
  value: string;
  detail: string;
};

export type AnalyticsMetricSlug =
  | "sessions-per-day"
  | "drawing-at-least-one-room"
  | "average-time-to-first-room"
  | "total-rooms-created";

export type AnalyticsMetricValueType = "integer" | "percent" | "duration";

export type AnalyticsMetricDetailPoint = {
  date: string;
  value: number;
};

export type AnalyticsMetricDetail = {
  slug: AnalyticsMetricSlug;
  href: string;
  label: string;
  value: string;
  detail: string;
  description: string;
  chartTitle: string;
  chartDescription: string;
  valueType: AnalyticsMetricValueType;
  data: AnalyticsMetricDetailPoint[];
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

const analyticsMetricDefinitions = [
  {
    slug: "sessions-per-day",
    label: "Sessions per day",
    detail: `Average daily sessions over the last ${SESSION_AVERAGE_DAYS} days`,
    description:
      "Daily session starts across the last 30 days. This keeps the chart simple and uses only existing app-open events.",
    chartTitle: "Daily sessions",
    chartDescription: "Unique sessions opened each day over the last 30 days.",
    valueType: "integer",
  },
  {
    slug: "drawing-at-least-one-room",
    label: "% drawing at least one room",
    detail: `Share of sessions with at least one room over the last ${SESSION_WINDOW_DAYS} days`,
    description:
      "The daily conversion rate from session start to at least one room created, grouped by the day each session began.",
    chartTitle: "Daily drawing rate",
    chartDescription: "Percentage of sessions opened on each day that drew at least one room.",
    valueType: "percent",
  },
  {
    slug: "average-time-to-first-room",
    label: "Average time to first room",
    detail: `Measured from session start over the last ${SESSION_WINDOW_DAYS} days`,
    description:
      "Average time from session start to the first room created, grouped by the day the session began.",
    chartTitle: "Daily average time to first room",
    chartDescription: "Average time-to-first-room for sessions opened on each day.",
    valueType: "duration",
  },
  {
    slug: "total-rooms-created",
    label: "Total rooms created",
    detail: "All tracked room creation events across all time",
    description:
      "A cumulative total based on tracked room-created events, shown as a calm running growth curve across the last 30 days.",
    chartTitle: "Cumulative room growth",
    chartDescription: "Running total of room-created events across the last 30 days.",
    valueType: "integer",
  },
] as const satisfies ReadonlyArray<{
  slug: AnalyticsMetricSlug;
  label: string;
  detail: string;
  description: string;
  chartTitle: string;
  chartDescription: string;
  valueType: AnalyticsMetricValueType;
}>;

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

function getMetricHref(slug: AnalyticsMetricSlug) {
  return `/admin/analytics/${slug}`;
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

type AnalyticsDerivedSeries = {
  sessionsPerDay: Map<string, Set<string>>;
  drawRatePerDay: Map<string, number>;
  averageTimeToFirstRoomPerDay: Map<string, number>;
  cumulativeRoomsCreatedPerDay: Map<string, number>;
  sessionAverage: number;
  drawRate: number;
  averageFirstRoomDuration: number | null;
  totalRoomsCreated: number;
};

function deriveAnalyticsSeries(
  events: AnalyticsEventRow[],
  totalRoomsCreated: number
): AnalyticsDerivedSeries {
  const detailDates = getDateSeries(SESSION_WINDOW_DAYS);
  const detailDateSet = new Set(detailDates);
  const sessionAverageDates = new Set(detailDates.slice(-SESSION_AVERAGE_DAYS));
  const sessionsPerDay = new Map<string, Set<string>>();
  const drawnSessionsPerOpenedDate = new Map<string, Set<string>>();
  const roomsCreatedPerDay = new Map<string, number>();
  const openedSessions = new Set<string>();
  const drawnSessions = new Set<string>();
  const firstRoomDurations = new Map<string, number>();
  const openedAtBySession = new Map<string, number>();
  const openedDateBySession = new Map<string, string>();
  const firstRoomAtBySession = new Map<string, number>();
  const durationTotalsByDate = new Map<string, number>();
  const durationCountsByDate = new Map<string, number>();

  for (const date of detailDates) {
    sessionsPerDay.set(date, new Set<string>());
    drawnSessionsPerOpenedDate.set(date, new Set<string>());
    roomsCreatedPerDay.set(date, 0);
  }

  for (const event of events) {
    const timestampMs = Date.parse(event.timestamp);
    if (Number.isNaN(timestampMs)) {
      continue;
    }

    const dateKey = event.timestamp.slice(0, 10);

    if (event.event === "app_opened") {
      openedSessions.add(event.session_id);
      if (detailDateSet.has(dateKey)) {
        sessionsPerDay.get(dateKey)?.add(event.session_id);
      }

      const existingOpenedAt = openedAtBySession.get(event.session_id);
      if (existingOpenedAt === undefined || timestampMs < existingOpenedAt) {
        openedAtBySession.set(event.session_id, timestampMs);
        openedDateBySession.set(event.session_id, dateKey);
      }
    }

    if (event.event === "room_created") {
      if (detailDateSet.has(dateKey)) {
        roomsCreatedPerDay.set(dateKey, (roomsCreatedPerDay.get(dateKey) ?? 0) + 1);
      }
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
        drawnSessions.add(event.session_id);
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

  for (const sessionId of drawnSessions) {
    const openedDate = openedDateBySession.get(sessionId);
    if (!openedDate || !detailDateSet.has(openedDate)) {
      continue;
    }

    drawnSessionsPerOpenedDate.get(openedDate)?.add(sessionId);
  }

  for (const sessionId of firstRoomAtBySession.keys()) {
    const openedDate = openedDateBySession.get(sessionId);
    if (!openedDate || !detailDateSet.has(openedDate)) {
      continue;
    }

    drawnSessions.add(sessionId);
    drawnSessionsPerOpenedDate.get(openedDate)?.add(sessionId);
  }

  for (const [sessionId, duration] of firstRoomDurations) {
    const openedDate = openedDateBySession.get(sessionId);
    if (!openedDate || !detailDateSet.has(openedDate)) {
      continue;
    }

    durationTotalsByDate.set(openedDate, (durationTotalsByDate.get(openedDate) ?? 0) + duration);
    durationCountsByDate.set(openedDate, (durationCountsByDate.get(openedDate) ?? 0) + 1);
  }

  const drawRatePerDay = new Map<string, number>();
  const averageTimeToFirstRoomPerDay = new Map<string, number>();
  const recentRoomsCreated = Array.from(roomsCreatedPerDay.values()).reduce(
    (total, count) => total + count,
    0
  );
  let cumulativeRoomsCreated = Math.max(0, totalRoomsCreated - recentRoomsCreated);
  const cumulativeRoomsCreatedPerDay = new Map<string, number>();

  for (const date of detailDates) {
    const sessionCount = sessionsPerDay.get(date)?.size ?? 0;
    const drawnCount = drawnSessionsPerOpenedDate.get(date)?.size ?? 0;
    const durationCount = durationCountsByDate.get(date) ?? 0;
    const durationTotal = durationTotalsByDate.get(date) ?? 0;

    drawRatePerDay.set(date, sessionCount === 0 ? 0 : drawnCount / sessionCount);
    averageTimeToFirstRoomPerDay.set(date, durationCount === 0 ? 0 : durationTotal / durationCount);

    cumulativeRoomsCreated += roomsCreatedPerDay.get(date) ?? 0;
    cumulativeRoomsCreatedPerDay.set(date, cumulativeRoomsCreated);
  }

  const sessionCountTotal = detailDates.reduce(
    (total, date) => total + (sessionAverageDates.has(date) ? (sessionsPerDay.get(date)?.size ?? 0) : 0),
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

  return {
    sessionsPerDay,
    drawRatePerDay,
    averageTimeToFirstRoomPerDay,
    cumulativeRoomsCreatedPerDay,
    sessionAverage,
    drawRate,
    averageFirstRoomDuration,
    totalRoomsCreated,
  };
}

function formatMetricValue(valueType: AnalyticsMetricValueType, value: number | null) {
  if (valueType === "percent") {
    return formatPercent(value ?? 0);
  }

  if (valueType === "duration") {
    return formatDuration(value);
  }

  return formatInteger(value ?? 0);
}

function getMetricDetailData(
  slug: AnalyticsMetricSlug,
  derivedSeries: AnalyticsDerivedSeries
): AnalyticsMetricDetailPoint[] {
  switch (slug) {
    case "sessions-per-day":
      return Array.from(derivedSeries.sessionsPerDay.entries()).map(([date, sessions]) => ({
        date,
        value: sessions.size,
      }));
    case "drawing-at-least-one-room":
      return Array.from(derivedSeries.drawRatePerDay.entries()).map(([date, value]) => ({
        date,
        value,
      }));
    case "average-time-to-first-room":
      return Array.from(derivedSeries.averageTimeToFirstRoomPerDay.entries()).map(([date, value]) => ({
        date,
        value,
      }));
    case "total-rooms-created":
      return Array.from(derivedSeries.cumulativeRoomsCreatedPerDay.entries()).map(([date, value]) => ({
        date,
        value,
      }));
  }
}

function buildMetricCards(derivedSeries: AnalyticsDerivedSeries): AnalyticsMetricCard[] {
  return analyticsMetricDefinitions.map((metric) => {
    const metricValue =
      metric.slug === "sessions-per-day"
        ? derivedSeries.sessionAverage
        : metric.slug === "drawing-at-least-one-room"
          ? derivedSeries.drawRate
          : metric.slug === "average-time-to-first-room"
            ? derivedSeries.averageFirstRoomDuration
            : derivedSeries.totalRoomsCreated;

    return {
      slug: metric.slug,
      href: getMetricHref(metric.slug),
      label: metric.label,
      value: formatMetricValue(metric.valueType, metricValue),
      detail: metric.detail,
    };
  });
}

function buildMetricDetail(
  slug: AnalyticsMetricSlug,
  derivedSeries: AnalyticsDerivedSeries
): AnalyticsMetricDetail {
  const metric = analyticsMetricDefinitions.find((candidate) => candidate.slug === slug);

  if (!metric) {
    throw new Error(`Unknown analytics metric slug: ${slug}`);
  }

  const card = buildMetricCards(derivedSeries).find((candidate) => candidate.slug === slug);
  if (!card) {
    throw new Error(`Missing analytics metric card for slug: ${slug}`);
  }

  return {
    slug,
    href: card.href,
    label: card.label,
    value: card.value,
    detail: card.detail,
    description: metric.description,
    chartTitle: metric.chartTitle,
    chartDescription: metric.chartDescription,
    valueType: metric.valueType,
    data: getMetricDetailData(slug, derivedSeries),
  };
}

export async function fetchAdminAnalyticsDashboardData(): Promise<AdminAnalyticsDashboardData> {
  const analyticsSinceIso = getDateDaysAgo(SESSION_WINDOW_DAYS - 1).toISOString();
  const feedbackSinceIso = getDateDaysAgo(FEEDBACK_TREND_DAYS - 1).toISOString();

  const [recentAnalyticsEvents, totalRoomsCreated, recentFeedbackSubmissions] = await Promise.all([
    fetchRecentAnalyticsEvents(analyticsSinceIso),
    fetchTotalRoomsCreated(),
    fetchRecentFeedbackSubmissions(feedbackSinceIso),
  ]);
  const derivedSeries = deriveAnalyticsSeries(recentAnalyticsEvents, totalRoomsCreated);

  return {
    metricCards: buildMetricCards(derivedSeries),
    feedbackTrend: buildFeedbackTrend(recentFeedbackSubmissions),
  };
}

export async function fetchAdminAnalyticsMetricDetail(
  slug: AnalyticsMetricSlug
): Promise<AnalyticsMetricDetail> {
  const analyticsSinceIso = getDateDaysAgo(SESSION_WINDOW_DAYS - 1).toISOString();
  const [recentAnalyticsEvents, totalRoomsCreated] = await Promise.all([
    fetchRecentAnalyticsEvents(analyticsSinceIso),
    fetchTotalRoomsCreated(),
  ]);

  return buildMetricDetail(slug, deriveAnalyticsSeries(recentAnalyticsEvents, totalRoomsCreated));
}

export function isAnalyticsMetricSlug(value: string): value is AnalyticsMetricSlug {
  return analyticsMetricDefinitions.some((metric) => metric.slug === value);
}
