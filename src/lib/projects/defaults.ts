import type { EditorDocumentState } from "@/lib/editor/history";

const DEFAULT_PROJECT_NAME_OPTIONS = [
  "My first layout",
  "New room idea",
  "Home sketch",
  "Floor plan draft",
  "Space concept",
  "Room layout",
  "Living space idea",
  "Plan in progress",
  "Untitled layout",
  "Sketch 01",
] as const;

export const DEFAULT_PROJECT_NAME = DEFAULT_PROJECT_NAME_OPTIONS[0];

export function getDefaultProjectName({ isFirstProject = false }: { isFirstProject?: boolean } = {}) {
  if (isFirstProject) return DEFAULT_PROJECT_NAME;

  const randomIndex = getRandomProjectNameIndex(DEFAULT_PROJECT_NAME_OPTIONS.length);
  return DEFAULT_PROJECT_NAME_OPTIONS[randomIndex];
}

export function createEmptyProjectDocument(): EditorDocumentState {
  return {
    rooms: [],
  };
}

function getRandomProjectNameIndex(optionCount: number) {
  if (optionCount <= 1) return 0;

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % optionCount;
  }

  return Math.floor(Math.random() * optionCount);
}
