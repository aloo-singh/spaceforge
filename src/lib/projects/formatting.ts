import { normalizeProjectRegion, type ProjectRegion } from "@/lib/projects/region";

function getProjectDateLocale(region?: ProjectRegion) {
  return normalizeProjectRegion(region) === "imperial" ? "en-US" : "en-GB";
}

export function formatProjectUpdatedAt(value: string, region?: ProjectRegion) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  return new Intl.DateTimeFormat(getProjectDateLocale(region), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatProjectCreatedAt(value: string, region?: ProjectRegion) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat(getProjectDateLocale(region), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
