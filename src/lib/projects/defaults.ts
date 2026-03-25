import { createEmptyEditorDocumentState, type EditorDocumentState } from "@/lib/editor/history";

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

export function getDefaultProjectName({ existingProjectCount = 0 }: { existingProjectCount?: number } = {}) {
  if (existingProjectCount <= 0) return DEFAULT_PROJECT_NAME;

  const secondaryNames = DEFAULT_PROJECT_NAME_OPTIONS.slice(1);
  const nextIndex = (existingProjectCount - 1) % secondaryNames.length;
  return secondaryNames[nextIndex];
}

export function createEmptyProjectDocument(): EditorDocumentState {
  return createEmptyEditorDocumentState();
}
