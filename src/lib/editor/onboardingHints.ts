export const EDITOR_HINT_DISMISSALS_STORAGE_KEY = "spaceforge.editor.onboarding.dismissed-hints.v3";
export const EDITOR_HINT_COMPLETIONS_STORAGE_KEY = "spaceforge.editor.onboarding.completed-hints.v7";

export type EditorOnboardingHintId =
  | "empty-canvas-draw"
  | "select-room-by-name"
  | "resize-room-by-dragging-edges"
  | "undo-last-action"
  | "export-as-png";

type EditorOnboardingHint = {
  id: EditorOnboardingHintId;
  message: string | ((context: EditorOnboardingHintContext) => string);
  shouldShow: (context: EditorOnboardingHintContext) => boolean;
};

type EditorOnboardingHintContext = {
  roomCount: number;
  isMacPlatform: boolean;
  dismissedHintIds: ReadonlySet<EditorOnboardingHintId>;
  completedHintIds: ReadonlySet<EditorOnboardingHintId>;
};

export type ActiveEditorOnboardingHint = {
  id: EditorOnboardingHintId;
  message: string;
};

const EDITOR_ONBOARDING_HINTS: EditorOnboardingHint[] = [
  {
    id: "empty-canvas-draw",
    message: "Click to start drawing",
    shouldShow: ({ roomCount }) => roomCount === 0,
  },
  {
    id: "select-room-by-name",
    message: "Click the room name to select it",
    shouldShow: ({ roomCount }) => roomCount > 0,
  },
  {
    id: "resize-room-by-dragging-edges",
    message: "Drag edges to resize",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("select-room-by-name"),
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
    };
  }

  return null;
}

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
    value === "select-room-by-name" ||
    value === "resize-room-by-dragging-edges" ||
    value === "undo-last-action" ||
    value === "export-as-png"
  );
}
