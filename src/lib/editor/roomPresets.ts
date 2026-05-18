import type { ProjectRegion } from "@/lib/projects/region";
import type { Room, RoomType } from "@/lib/editor/types";

export type RoomPreset = {
  id: RoomType;
  labels: Record<ProjectRegion, string>;
  baseNames: Record<ProjectRegion, string>;
  color: string;
};

export const ROOM_PRESETS = [
  {
    id: "hall-landing",
    labels: {
      metric: "Hall / Landing",
      imperial: "Hall / Landing",
    },
    baseNames: {
      metric: "Hall",
      imperial: "Hall",
    },
    color: "#71717a",
  },
  {
    id: "lounge",
    labels: {
      metric: "Lounge",
      imperial: "Living",
    },
    baseNames: {
      metric: "Lounge",
      imperial: "Living Room",
    },
    color: "#d8b58a",
  },
  {
    id: "study",
    labels: {
      metric: "Study",
      imperial: "Office",
    },
    baseNames: {
      metric: "Study",
      imperial: "Office",
    },
    color: "#a78bfa",
  },
  {
    id: "kitchen",
    labels: {
      metric: "Kitchen",
      imperial: "Kitchen",
    },
    baseNames: {
      metric: "Kitchen",
      imperial: "Kitchen",
    },
    color: "#60a5fa",
  },
  {
    id: "utility",
    labels: {
      metric: "Utility",
      imperial: "Laundry",
    },
    baseNames: {
      metric: "Utility",
      imperial: "Laundry",
    },
    color: "#94a3b8",
  },
  {
    id: "wc",
    labels: {
      metric: "WC",
      imperial: "Half Bath",
    },
    baseNames: {
      metric: "WC",
      imperial: "Half Bath",
    },
    color: "#38bdf8",
  },
  {
    id: "bedroom",
    labels: {
      metric: "Bedroom",
      imperial: "Bedroom",
    },
    baseNames: {
      metric: "Bedroom",
      imperial: "Bedroom",
    },
    color: "#86efac",
  },
  {
    id: "bathroom",
    labels: {
      metric: "Bathroom",
      imperial: "Bathroom",
    },
    baseNames: {
      metric: "Bathroom",
      imperial: "Bathroom",
    },
    color: "#3b82f6",
  },
  {
    id: "ensuite",
    labels: {
      metric: "En-suite",
      imperial: "En-suite",
    },
    baseNames: {
      metric: "En-suite",
      imperial: "En-suite",
    },
    color: "#2563eb",
  },
] as const satisfies readonly RoomPreset[];

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
