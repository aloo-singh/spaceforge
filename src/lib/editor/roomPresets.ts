import type { ProjectRegion } from "@/lib/projects/region";
import type { Room, RoomType } from "@/lib/editor/types";

export type RoomPreset = {
  id: RoomType;
  labels: Record<ProjectRegion, string>;
  baseNames: Record<ProjectRegion, string>;
  color: string;
};

export type RoomPresetPickerOption =
  | {
      type: "single";
      preset: RoomPreset;
    }
  | {
      type: "split";
      top: RoomPreset;
      bottom: RoomPreset;
    };

export const ROOM_PRESET_COLORS = {
  zinc500: "#71717a",
  amber300: "#fcd34d",
  violet400: "#a78bfa",
  blue400: "#60a5fa",
  slate400: "#94a3b8",
  sky400: "#38bdf8",
  green300: "#86efac",
  blue500: "#3b82f6",
  blue600: "#2563eb",
} as const;

const HALL_PRESET = {
  id: "hall",
  labels: {
    metric: "Hall",
    imperial: "Hall",
  },
  baseNames: {
    metric: "Hall",
    imperial: "Hall",
  },
  color: ROOM_PRESET_COLORS.zinc500,
} as const satisfies RoomPreset;

const LANDING_PRESET = {
  id: "landing",
  labels: {
    metric: "Landing",
    imperial: "Landing",
  },
  baseNames: {
    metric: "Landing",
    imperial: "Landing",
  },
  color: ROOM_PRESET_COLORS.zinc500,
} as const satisfies RoomPreset;

const LOUNGE_PRESET = {
  id: "lounge",
  labels: {
    metric: "Lounge",
    imperial: "Living",
  },
  baseNames: {
    metric: "Lounge",
    imperial: "Living Room",
  },
  color: ROOM_PRESET_COLORS.amber300,
} as const satisfies RoomPreset;

const STUDY_PRESET = {
  id: "study",
  labels: {
    metric: "Study",
    imperial: "Office",
  },
  baseNames: {
    metric: "Study",
    imperial: "Office",
  },
  color: ROOM_PRESET_COLORS.violet400,
} as const satisfies RoomPreset;

const KITCHEN_PRESET = {
  id: "kitchen",
  labels: {
    metric: "Kitchen",
    imperial: "Kitchen",
  },
  baseNames: {
    metric: "Kitchen",
    imperial: "Kitchen",
  },
  color: ROOM_PRESET_COLORS.blue400,
} as const satisfies RoomPreset;

const UTILITY_PRESET = {
  id: "utility",
  labels: {
    metric: "Utility",
    imperial: "Laundry",
  },
  baseNames: {
    metric: "Utility",
    imperial: "Laundry",
  },
  color: ROOM_PRESET_COLORS.slate400,
} as const satisfies RoomPreset;

const WC_PRESET = {
  id: "wc",
  labels: {
    metric: "WC",
    imperial: "Half Bath",
  },
  baseNames: {
    metric: "WC",
    imperial: "Half Bath",
  },
  color: ROOM_PRESET_COLORS.sky400,
} as const satisfies RoomPreset;

const BEDROOM_PRESET = {
  id: "bedroom",
  labels: {
    metric: "Bedroom",
    imperial: "Bedroom",
  },
  baseNames: {
    metric: "Bedroom",
    imperial: "Bedroom",
  },
  color: ROOM_PRESET_COLORS.green300,
} as const satisfies RoomPreset;

const BATHROOM_PRESET = {
  id: "bathroom",
  labels: {
    metric: "Bathroom",
    imperial: "Bathroom",
  },
  baseNames: {
    metric: "Bathroom",
    imperial: "Bathroom",
  },
  color: ROOM_PRESET_COLORS.blue500,
} as const satisfies RoomPreset;

const ENSUITE_PRESET = {
  id: "ensuite",
  labels: {
    metric: "En-suite",
    imperial: "En-suite",
  },
  baseNames: {
    metric: "En-suite",
    imperial: "En-suite",
  },
  color: ROOM_PRESET_COLORS.blue600,
} as const satisfies RoomPreset;

export const ROOM_PRESETS = [
  HALL_PRESET,
  LANDING_PRESET,
  LOUNGE_PRESET,
  STUDY_PRESET,
  KITCHEN_PRESET,
  UTILITY_PRESET,
  WC_PRESET,
  BEDROOM_PRESET,
  BATHROOM_PRESET,
  ENSUITE_PRESET,
] as const satisfies readonly RoomPreset[];

export const ROOM_PRESET_PICKER_OPTIONS = [
  {
    type: "split",
    top: HALL_PRESET,
    bottom: LANDING_PRESET,
  },
  {
    type: "single",
    preset: LOUNGE_PRESET,
  },
  {
    type: "single",
    preset: STUDY_PRESET,
  },
  {
    type: "single",
    preset: KITCHEN_PRESET,
  },
  {
    type: "single",
    preset: UTILITY_PRESET,
  },
  {
    type: "single",
    preset: WC_PRESET,
  },
  {
    type: "single",
    preset: BEDROOM_PRESET,
  },
  {
    type: "split",
    top: BATHROOM_PRESET,
    bottom: ENSUITE_PRESET,
  },
] as const satisfies readonly RoomPresetPickerOption[];

export type RoomPresetId = (typeof ROOM_PRESETS)[number]["id"];

export function getRoomPresetById(presetId: RoomPresetId): RoomPreset | null {
  return ROOM_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function getRegionalRoomPresetLabel(preset: RoomPreset, region: ProjectRegion): string {
  return preset.labels[region];
}

export function getRegionalRoomPresetBaseName(preset: RoomPreset, region: ProjectRegion): string {
  return preset.baseNames[region];
}

export function getSmartRoomName(
  baseName: string,
  rooms: Room[],
  options?: { floorId?: string | null; excludeRoomId?: string | null }
): string {
  const normalizedBaseName = baseName.trim() || "Room";
  const existingNames = new Set(
    rooms
      .filter((room) => room.id !== options?.excludeRoomId)
      .filter((room) => !options?.floorId || room.floorId === options.floorId)
      .map((room) => room.name.trim())
      .filter(Boolean)
  );

  if (!existingNames.has(normalizedBaseName)) return normalizedBaseName;

  let counter = 2;
  while (existingNames.has(`${normalizedBaseName} ${counter}`)) {
    counter += 1;
  }

  return `${normalizedBaseName} ${counter}`;
}
