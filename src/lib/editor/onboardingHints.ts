export const EDITOR_HINT_DISMISSALS_STORAGE_KEY = "spaceforge.editor.onboarding.dismissed-hints.v3";
export const EDITOR_HINT_COMPLETIONS_STORAGE_KEY = "spaceforge.editor.onboarding.completed-hints.v7";
export const EDITOR_ONBOARDING_AUTO_COMPLETE_MS = {
  projectOwnership: 3600,
  projectName: 5600,
} as const;

export type EditorOnboardingHintId =
  | "empty-canvas-draw"
  | "close-shape-to-make-room"
  | "project-ownership"
  | "project-name"
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
  roomDraftPointCount: number;
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
    shouldShow: ({ roomCount, roomDraftPointCount }) => roomCount === 0 && roomDraftPointCount === 0,
  },
  {
    id: "close-shape-to-make-room",
    message: "Close the shape to make a room",
    shouldShow: ({ roomCount, roomDraftPointCount, completedHintIds }) =>
      roomCount === 0 &&
      roomDraftPointCount >= 3 &&
      completedHintIds.has("empty-canvas-draw"),
  },
  {
    id: "project-ownership",
    message: "This is your project. It saves automatically.",
    shouldShow: ({ roomCount, hasResolvedProject, completedHintIds }) =>
      roomCount > 0 &&
      hasResolvedProject &&
      completedHintIds.has("close-shape-to-make-room"),
    autoCompleteAfterMs: EDITOR_ONBOARDING_AUTO_COMPLETE_MS.projectOwnership,
  },
  {
    id: "project-name",
    message: "Give it a name so you can find it later in Projects.",
    shouldShow: ({ roomCount, hasResolvedProject, completedHintIds }) =>
      roomCount > 0 &&
      hasResolvedProject &&
      completedHintIds.has("project-ownership"),
    autoCompleteAfterMs: EDITOR_ONBOARDING_AUTO_COMPLETE_MS.projectName,
  },
  {
    id: "resize-room-by-dragging-edges",
    message: "Select a room, then drag an edge to resize",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("undo-last-action"),
  },
  {
    id: "undo-last-action",
    message: "You can always undo if you want to try again",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("project-name"),
  },
  {
    id: "pan-canvas",
    message: "Hold SPACE and drag to pan, or middle mouse drag",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("resize-room-by-dragging-edges"),
  },
  {
    id: "export-as-png",
    message: "Export as PNG when you're ready",
    shouldShow: ({ roomCount, completedHintIds }) =>
      roomCount > 0 && completedHintIds.has("pan-canvas"),
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
    value === "close-shape-to-make-room" ||
    value === "project-ownership" ||
    value === "project-name" ||
    value === "resize-room-by-dragging-edges" ||
    value === "undo-last-action" ||
    value === "export-as-png" ||
    value === "pan-canvas"
  );
}
