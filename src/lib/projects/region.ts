export type ProjectRegion = "metric" | "imperial";

export const DEFAULT_PROJECT_REGION: ProjectRegion = "metric";

export function isProjectRegion(value: unknown): value is ProjectRegion {
  return value === "metric" || value === "imperial";
}

export function normalizeProjectRegion(value: unknown): ProjectRegion {
  return isProjectRegion(value) ? value : DEFAULT_PROJECT_REGION;
}
