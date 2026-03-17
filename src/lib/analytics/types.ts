export type AnalyticsPropertyValue = string | number | boolean | null;

export type AnalyticsEventProperties = Record<string, AnalyticsPropertyValue>;

export type AnalyticsEvent = {
  event: string;
  timestamp: string;
  sessionId: string;
  route: string;
  version: string;
  source: "app";
  properties?: AnalyticsEventProperties;
};

export function isAnalyticsEventProperties(value: unknown): value is AnalyticsEventProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((propertyValue) => {
    if (propertyValue === null) {
      return true;
    }

    const propertyType = typeof propertyValue;
    return propertyType === "string" || propertyType === "number" || propertyType === "boolean";
  });
}

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<AnalyticsEvent>;

  if (
    typeof candidate.event !== "string" ||
    candidate.event.length === 0 ||
    typeof candidate.timestamp !== "string" ||
    Number.isNaN(Date.parse(candidate.timestamp)) ||
    typeof candidate.sessionId !== "string" ||
    candidate.sessionId.length === 0 ||
    typeof candidate.route !== "string" ||
    candidate.route.length === 0 ||
    typeof candidate.version !== "string" ||
    candidate.version.length === 0 ||
    candidate.source !== "app"
  ) {
    return false;
  }

  if (candidate.properties === undefined) {
    return true;
  }

  return isAnalyticsEventProperties(candidate.properties);
}
