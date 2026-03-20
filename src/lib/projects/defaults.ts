import type { EditorDocumentState } from "@/lib/editor/history";

export const DEFAULT_PROJECT_NAME = "Untitled project";

export function createEmptyProjectDocument(): EditorDocumentState {
  return {
    rooms: [],
  };
}
