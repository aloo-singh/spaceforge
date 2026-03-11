export const EDITOR_HINT_DISMISSALS_STORAGE_KEY = "spaceforge.editor.onboarding.dismissed-hints";

export type EditorOnboardingHintId = "empty-canvas-draw";

type EditorOnboardingHint = {
  id: EditorOnboardingHintId;
  message: string;
  shouldShow: (context: EditorOnboardingHintContext) => boolean;
};

type EditorOnboardingHintContext = {
  roomCount: number;
  dismissedHintIds: ReadonlySet<EditorOnboardingHintId>;
};

const EDITOR_ONBOARDING_HINTS: EditorOnboardingHint[] = [
  {
    id: "empty-canvas-draw",
    message: "Click to start drawing",
    shouldShow: ({ roomCount }) => roomCount === 0,
  },
];

export function getActiveEditorOnboardingHint(context: EditorOnboardingHintContext) {
  for (const hint of EDITOR_ONBOARDING_HINTS) {
    if (context.dismissedHintIds.has(hint.id)) continue;
    if (hint.shouldShow(context)) return hint;
  }

  return null;
}

export function loadDismissedEditorHintIds(): EditorOnboardingHintId[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(EDITOR_HINT_DISMISSALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const dismissed = parsed.filter((value): value is EditorOnboardingHintId =>
      value === "empty-canvas-draw"
    );

    return Array.from(new Set(dismissed));
  } catch {
    return [];
  }
}

export function saveDismissedEditorHintIds(dismissedHintIds: EditorOnboardingHintId[]): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(
      EDITOR_HINT_DISMISSALS_STORAGE_KEY,
      JSON.stringify(Array.from(new Set(dismissedHintIds)))
    );
    return true;
  } catch {
    return false;
  }
}
