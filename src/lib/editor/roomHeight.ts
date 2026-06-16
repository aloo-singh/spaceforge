import { normalizeUnitOrigin, type UnitOrigin } from "@/lib/projects/region";

export const DEFAULT_METRIC_ROOM_HEIGHT_MM = 2400;
export const DEFAULT_IMPERIAL_ROOM_HEIGHT_MM = 2438;

export function getDefaultRoomHeightMm(unitOrigin?: UnitOrigin): number {
  return normalizeUnitOrigin(unitOrigin) === "imperial"
    ? DEFAULT_IMPERIAL_ROOM_HEIGHT_MM
    : DEFAULT_METRIC_ROOM_HEIGHT_MM;
}

export function normalizeRoomHeightMm(value: unknown, unitOrigin?: UnitOrigin): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : getDefaultRoomHeightMm(unitOrigin);
}
