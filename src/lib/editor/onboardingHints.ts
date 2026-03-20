export const EDITOR_HINT_DISMISSALS_STORAGE_KEY = "spaceforge.editor.onboarding.dismissed-hints.v3";
export const EDITOR_HINT_COMPLETIONS_STORAGE_KEY = "spaceforge.editor.onboarding.completed-hints.v7";

export type EditorOnboardingHintId =
  | "empty-canvas-draw"
  | "project-name-and-autosave"
  | "projects-list-awareness"
  | "resize-room-by-dragging-edges"
  | "undo-last-action"
  | "export-as-png"
  | "pan-canvas";

type EditorOnboardingHint = {
  id: EditorOnboardingHintId;
  message: string | ((context: EditorOnboardingHintContext) => string);
  shouldShow: (context: EditorOnboardingHintContext) => boolean;
  autoCompleteAfterMs?: number;
};

type EditorOnboardingHintContext = {
  roomCount: number;
  hasResolvedProject: boolean;
  isMacPlatform: boolean;
  dismissedHintIds: ReadonlySet<EditorOnboardingHintId>;
  completedHintIds: ReadonlySet<EditorOnboardingHintId>;
};

export type ActiveEditorOnboardingHint = {
  id: EditorOnboardingHintId;
  message: string;
  autoCompleteAfterMs?: number;
};

const EDITOR_ONBOARDING_HINTS: EditorOnboardingHint[] = [
  {
    id: "empty-canvas-draw",
    message: "Click to start drawing",
    shouldShow: ({ roomCount }) => roomCount === 0,
  },
  {
    id: "project-name-and-autosave",
    message: "This project saves automatically. Click its name to rename it.",
    shouldShow: ({ roomCount, hasResolvedProject }) => roomCount > 0 && hasResolvedProject,
    autoCompleteAfterMs: 3600,
  },
  {
    id: "projects-list-awareness",
    message: "Find your layouts any time in Projects.",
    shouldShow: ({ roomCount, hasResolvedProject, completedHintIds }) =>
      roomCount > 0 &&
      hasResolvedProject &&
      completedHintIds.has("project-name-and-autosave"),
    autoCompleteAfterMs: 2800,
  },
  {
    id: "resize-room-by-dragging-edges",
    message: "Select a room, then drag an edge to resize",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("projects-list-awareness"),
  },
  {
    id: "undo-last-action",
    message: ({ isMacPlatform }) =>
      isMacPlatform ? "Press ⌘Z to undo" : "Press Ctrl+Z to undo",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("resize-room-by-dragging-edges"),
  },
  {
    id: "export-as-png",
    message: "Export as PNG when you're ready",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("undo-last-action"),
  },
  {
    id: "pan-canvas",
    message: "Hold SPACE and drag to pan, or middle mouse drag",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("export-as-png"),
  },
];

export function getActiveEditorOnboardingHint(
  context: EditorOnboardingHintContext
): ActiveEditorOnboardingHint | null {
  for (const hint of EDITOR_ONBOARDING_HINTS) {
    if (context.dismissedHintIds.has(hint.id)) continue;
    if (context.completedHintIds.has(hint.id)) continue;
    if (!hint.shouldShow(context)) continue;

    return {
      id: hint.id,
      message: typeof hint.message === "function" ? hint.message(context) : hint.message,
      autoCompleteAfterMs: hint.autoCompleteAfterMs,
    };
  }

  return null;
}

export const TOTAL_EDITOR_ONBOARDING_STEPS = EDITOR_ONBOARDING_HINTS.length;

export function loadDismissedEditorHintIds(): EditorOnboardingHintId[] {
  return loadEditorHintIdsFromStorage(EDITOR_HINT_DISMISSALS_STORAGE_KEY);
}

export function saveDismissedEditorHintIds(dismissedHintIds: EditorOnboardingHintId[]): boolean {
  return saveEditorHintIdsToStorage(EDITOR_HINT_DISMISSALS_STORAGE_KEY, dismissedHintIds);
}

export function loadCompletedEditorHintIds(): EditorOnboardingHintId[] {
  return loadEditorHintIdsFromStorage(EDITOR_HINT_COMPLETIONS_STORAGE_KEY);
}

export function saveCompletedEditorHintIds(completedHintIds: EditorOnboardingHintId[]): boolean {
  return saveEditorHintIdsToStorage(EDITOR_HINT_COMPLETIONS_STORAGE_KEY, completedHintIds);
}

export function completeEditorOnboardingHint(hintId: EditorOnboardingHintId): boolean {
  const completedHintIds = loadCompletedEditorHintIds();
  if (completedHintIds.includes(hintId)) return true;
  return saveCompletedEditorHintIds([...completedHintIds, hintId]);
}

function loadEditorHintIdsFromStorage(storageKey: string): EditorOnboardingHintId[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const parsedIds = parsed.filter((value): value is EditorOnboardingHintId => isEditorHintId(value));

    return Array.from(new Set(parsedIds));
  } catch {
    return [];
  }
}

function saveEditorHintIdsToStorage(storageKey: string, hintIds: EditorOnboardingHintId[]): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set(hintIds))));
    return true;
  } catch {
    return false;
  }
}

function isEditorHintId(value: unknown): value is EditorOnboardingHintId {
  return (
    value === "empty-canvas-draw" ||
    value === "project-name-and-autosave" ||
    value === "projects-list-awareness" ||
    value === "resize-room-by-dragging-edges" ||
    value === "undo-last-action" ||
    value === "export-as-png" ||
    value === "pan-canvas"
  );
}
