import { toast } from "sonner";

export type EditorKeyboardShortcutId =
  | "toggle-canvas-hud"
  | "toggle-guidelines"
  | "toggle-snapping"
  | "undo"
  | "redo"
  | "delete-selection";

type EditorKeyboardShortcutBinding = {
  key?: string;
  code?: string;
  primaryModifier?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

type KeyboardShortcutFeedbackContext = {
  isEnabled?: boolean;
};

export type EditorKeyboardShortcut = {
  id: EditorKeyboardShortcutId;
  keyCombination: string;
  description: string;
  macKeys: string;
  windowsKeys: string;
  type: "toggle" | "action";
  bindings: readonly EditorKeyboardShortcutBinding[];
  sonnerMessage?: string | ((context: KeyboardShortcutFeedbackContext) => string | null);
};

const KEYBOARD_SHORTCUT_FEEDBACK_DURATION_MS = 2000;

export const EDITOR_KEYBOARD_SHORTCUTS: readonly EditorKeyboardShortcut[] = [
  {
    id: "toggle-canvas-hud",
    keyCombination: "H",
    description: "Toggle the canvas HUD",
    macKeys: "H",
    windowsKeys: "H",
    type: "toggle",
    bindings: [{ key: "h", code: "KeyH" }],
    sonnerMessage: ({ isEnabled }) => (isEnabled ? "HUD shown" : "HUD hidden"),
  },
  {
    id: "toggle-guidelines",
    keyCombination: "G",
    description: "Toggle predictive guidelines",
    macKeys: "G",
    windowsKeys: "G",
    type: "toggle",
    bindings: [{ key: "g", code: "KeyG" }],
    sonnerMessage: ({ isEnabled }) => (isEnabled ? "Guidelines on" : "Guidelines off"),
  },
  {
    id: "toggle-snapping",
    keyCombination: "S",
    description: "Toggle snapping",
    macKeys: "S",
    windowsKeys: "S",
    type: "toggle",
    bindings: [{ key: "s", code: "KeyS" }],
    sonnerMessage: ({ isEnabled }) => (isEnabled ? "Snapping on" : "Snapping off"),
  },
  {
    id: "undo",
    keyCombination: "Primary+Z",
    description: "Undo the last edit",
    macKeys: "Cmd+Z",
    windowsKeys: "Ctrl+Z",
    type: "action",
    bindings: [{ key: "z", code: "KeyZ", primaryModifier: true, altKey: false, shiftKey: false }],
    sonnerMessage: "Undo",
  },
  {
    id: "redo",
    keyCombination: "Primary+Shift+Z / Ctrl+Y",
    description: "Redo the last undone edit",
    macKeys: "Shift+Cmd+Z",
    windowsKeys: "Ctrl+Shift+Z / Ctrl+Y",
    type: "action",
    bindings: [
      { key: "z", code: "KeyZ", primaryModifier: true, altKey: false, shiftKey: true },
      { key: "y", code: "KeyY", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
    ],
    sonnerMessage: "Redo",
  },
  {
    id: "delete-selection",
    keyCombination: "Delete / Backspace",
    description: "Delete the current selection",
    macKeys: "Delete / Backspace",
    windowsKeys: "Delete / Backspace",
    type: "action",
    bindings: [
      { key: "Delete", altKey: false, ctrlKey: false, metaKey: false },
      { key: "Backspace", altKey: false, ctrlKey: false, metaKey: false },
    ],
    sonnerMessage: "Selection deleted",
  },
] as const;

const EDITOR_KEYBOARD_SHORTCUTS_BY_ID = new Map(
  EDITOR_KEYBOARD_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut])
);

let activeKeyboardShortcutFeedbackToastId: string | number | null = null;

export function getEditorKeyboardShortcut(
  shortcutId: EditorKeyboardShortcutId
): EditorKeyboardShortcut {
  const shortcut = EDITOR_KEYBOARD_SHORTCUTS_BY_ID.get(shortcutId);
  if (!shortcut) {
    throw new Error(`Unknown editor keyboard shortcut: ${shortcutId}`);
  }

  return shortcut;
}

export function matchEditorKeyboardShortcut(
  event: KeyboardEvent,
  shortcutIds?: readonly EditorKeyboardShortcutId[]
): EditorKeyboardShortcut | null {
  const shortcuts = shortcutIds
    ? shortcutIds.map((shortcutId) => getEditorKeyboardShortcut(shortcutId))
    : EDITOR_KEYBOARD_SHORTCUTS;

  for (const shortcut of shortcuts) {
    if (shortcut.bindings.some((binding) => doesBindingMatchEvent(binding, event))) {
      return shortcut;
    }
  }

  return null;
}

export function getKeyboardShortcutFeedbackMessage(
  shortcutId: EditorKeyboardShortcutId,
  context: KeyboardShortcutFeedbackContext = {}
): string | null {
  const shortcut = getEditorKeyboardShortcut(shortcutId);
  if (!shortcut.sonnerMessage) return null;

  return typeof shortcut.sonnerMessage === "function"
    ? shortcut.sonnerMessage(context)
    : shortcut.sonnerMessage;
}

export function showKeyboardShortcutFeedbackToast(message: string) {
  if (activeKeyboardShortcutFeedbackToastId !== null) {
    toast.dismiss(activeKeyboardShortcutFeedbackToastId);
  }

  const id = toast(message, {
    duration: KEYBOARD_SHORTCUT_FEEDBACK_DURATION_MS,
    onDismiss: () => {
      if (activeKeyboardShortcutFeedbackToastId === id) {
        activeKeyboardShortcutFeedbackToastId = null;
      }
    },
  });

  activeKeyboardShortcutFeedbackToastId = id;
}

function doesBindingMatchEvent(binding: EditorKeyboardShortcutBinding, event: KeyboardEvent) {
  const eventKey = event.key.toLowerCase();
  const bindingKey = binding.key?.toLowerCase();
  const isPrimaryModifier = event.metaKey || event.ctrlKey;

  if (binding.key !== undefined && bindingKey !== eventKey) return false;
  if (binding.code !== undefined && binding.code !== event.code) return false;
  if (binding.primaryModifier !== undefined && binding.primaryModifier !== isPrimaryModifier) return false;
  if (binding.metaKey !== undefined && binding.metaKey !== event.metaKey) return false;
  if (binding.ctrlKey !== undefined && binding.ctrlKey !== event.ctrlKey) return false;
  if (binding.altKey !== undefined && binding.altKey !== event.altKey) return false;
  if (binding.shiftKey !== undefined && binding.shiftKey !== event.shiftKey) return false;

  return true;
}
