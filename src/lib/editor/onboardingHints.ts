export const EDITOR_HINT_DISMISSALS_STORAGE_KEY = "spaceforge.editor.onboarding.dismissed-hints";
export const EDITOR_HINT_COMPLETIONS_STORAGE_KEY = "spaceforge.editor.onboarding.completed-hints.v2";

export type EditorOnboardingHintId = "empty-canvas-draw" | "select-room-by-name";

type EditorOnboardingHint = {
  id: EditorOnboardingHintId;
  message: string;
  shouldShow: (context: EditorOnboardingHintContext) => boolean;
};

type EditorOnboardingHintContext = {
  roomCount: number;
  dismissedHintIds: ReadonlySet<EditorOnboardingHintId>;
  completedHintIds: ReadonlySet<EditorOnboardingHintId>;
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
];

export function getActiveEditorOnboardingHint(context: EditorOnboardingHintContext) {
  for (const hint of EDITOR_ONBOARDING_HINTS) {
    if (context.dismissedHintIds.has(hint.id)) continue;
    if (context.completedHintIds.has(hint.id)) continue;
    if (hint.shouldShow(context)) return hint;
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
  return value === "empty-canvas-draw" || value === "select-room-by-name";
}
