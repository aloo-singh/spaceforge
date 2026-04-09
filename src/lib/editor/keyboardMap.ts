import { toast } from "sonner";
import type { EditorCommand } from "@/lib/editor/history";
import type { RoomInteriorAsset } from "@/lib/editor/types";

export type EditorKeyboardShortcutId =
  | "toggle-canvas-hud"
  | "toggle-guidelines"
  | "toggle-snapping"
  | "undo"
  | "redo"
  | "delete-selection"
  | "hold-pan"
  | "cancel-draft-or-clear-selection"
  | "step-back-draft";

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
  actionLabel?: string;
};

export type EditorKeyboardShortcut = {
  id: EditorKeyboardShortcutId;
  section: "View" | "Edit" | "Drawing";
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
    section: "View",
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
    section: "View",
    keyCombination: "G",
    description: "Toggle predictive guidelines",
    macKeys: "G",
    windowsKeys: "G",
    type: "toggle",
    bindings: [{ key: "g", code: "KeyG" }],
    sonnerMessage: ({ isEnabled }) => (isEnabled ? "Guidelines enabled" : "Guidelines disabled"),
  },
  {
    id: "toggle-snapping",
    section: "View",
    keyCombination: "S",
    description: "Toggle snapping",
    macKeys: "S",
    windowsKeys: "S",
    type: "toggle",
    bindings: [{ key: "s", code: "KeyS" }],
    sonnerMessage: ({ isEnabled }) => (isEnabled ? "Snapping enabled" : "Snapping disabled"),
  },
  {
    id: "undo",
    section: "Edit",
    keyCombination: "Primary+Z",
    description: "Undo the last edit",
    macKeys: "Cmd+Z",
    windowsKeys: "Ctrl+Z",
    type: "action",
    bindings: [{ key: "z", code: "KeyZ", primaryModifier: true, altKey: false, shiftKey: false }],
    sonnerMessage: ({ actionLabel }) => `Undo ${actionLabel ?? "action"}`,
  },
  {
    id: "redo",
    section: "Edit",
    keyCombination: "Primary+Shift+Z / Ctrl+Y",
    description: "Redo the last undone edit",
    macKeys: "Shift+Cmd+Z",
    windowsKeys: "Ctrl+Shift+Z / Ctrl+Y",
    type: "action",
    bindings: [
      { key: "z", code: "KeyZ", primaryModifier: true, altKey: false, shiftKey: true },
      { key: "y", code: "KeyY", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
    ],
    sonnerMessage: ({ actionLabel }) => `Redo ${actionLabel ?? "action"}`,
  },
  {
    id: "delete-selection",
    section: "Edit",
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
  {
    id: "hold-pan",
    section: "View",
    keyCombination: "Hold Space",
    description: "Temporarily pan the canvas",
    macKeys: "Hold Space",
    windowsKeys: "Hold Space",
    type: "action",
    bindings: [{ code: "Space" }],
  },
  {
    id: "cancel-draft-or-clear-selection",
    section: "Drawing",
    keyCombination: "Escape",
    description: "Cancel the current draft or clear the room selection",
    macKeys: "Escape",
    windowsKeys: "Escape",
    type: "action",
    bindings: [{ code: "Escape" }],
  },
  {
    id: "step-back-draft",
    section: "Drawing",
    keyCombination: "Backspace",
    description: "Remove the last draft point while drawing",
    macKeys: "Backspace",
    windowsKeys: "Backspace",
    type: "action",
    bindings: [{ code: "Backspace", metaKey: false, ctrlKey: false, altKey: false }],
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

export function showKeyboardShortcutFeedback(
  shortcutId: EditorKeyboardShortcutId,
  options: {
    feedbackEnabled: boolean;
    context?: KeyboardShortcutFeedbackContext;
  }
) {
  if (!options.feedbackEnabled) return;

  const message = getKeyboardShortcutFeedbackMessage(shortcutId, options.context);
  if (!message) return;

  showKeyboardShortcutFeedbackToast(message);
}

export function getHistoryCommandActionLabel(command: EditorCommand | undefined): string {
  if (!command) return "action";

  if (command.type === "update-canvas-rotation") {
    return "canvas rotation";
  }

  if (command.type === "update-north-bearing") {
    return "north rotation";
  }

  if (command.type === "complete-room") {
    return "room creation";
  }

  if (command.type === "delete-room") {
    return "room deletion";
  }

  if (command.type === "rename-room") {
    return "room rename";
  }

  if (command.type === "resize-room") {
    return "room resize";
  }

  if (command.type === "move-room") {
    return "room move";
  }

  if (command.type === "add-opening") {
    return "opening creation";
  }

  if (command.type === "delete-opening") {
    return "opening deletion";
  }

  if (command.type === "move-opening") {
    return "opening move";
  }

  if (command.type === "update-opening") {
    if (command.previousOpening.widthMm !== command.nextOpening.widthMm) {
      return "opening resize";
    }

    return "opening edit";
  }

  if (command.type === "add-interior-asset") {
    return getInteriorAssetActionLabel(command.asset.type, "creation");
  }

  if (command.type === "delete-interior-asset") {
    return getInteriorAssetActionLabel(command.asset.type, "deletion");
  }

  if (command.type === "move-interior-asset") {
    return "interior asset move";
  }

  if (command.type === "update-interior-asset") {
    const previousAsset = command.previousAsset;
    const nextAsset = command.nextAsset;

    if (previousAsset.rotationDegrees !== nextAsset.rotationDegrees) {
      return getInteriorAssetActionLabel(nextAsset.type, "rotation");
    }

    if (
      previousAsset.widthMm !== nextAsset.widthMm ||
      previousAsset.depthMm !== nextAsset.depthMm
    ) {
      return getInteriorAssetActionLabel(nextAsset.type, "resize");
    }

    if (
      previousAsset.name !== nextAsset.name ||
      previousAsset.arrowLabel !== nextAsset.arrowLabel ||
      previousAsset.arrowDirection !== nextAsset.arrowDirection ||
      previousAsset.arrowEnabled !== nextAsset.arrowEnabled
    ) {
      return getInteriorAssetActionLabel(nextAsset.type, "edit");
    }

    return "interior asset edit";
  }

  return "action";
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

function getInteriorAssetActionLabel(
  type: RoomInteriorAsset["type"],
  action: "creation" | "deletion" | "rotation" | "resize" | "edit"
) {
  const assetLabel = type === "stairs" ? "stair" : "interior asset";
  return `${assetLabel} ${action}`;
}
