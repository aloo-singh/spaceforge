/**
 * Global Editor UI Settings
 * 
 * These settings persist across all projects and browser sessions.
 * They are stored in localStorage and apply universally to the editor experience.
 */

export type GlobalEditorUISettings = {
  sidebarDensity: "comfortable" | "compact";
  keyboardShortcutFeedbackEnabled: boolean;
};

const GLOBAL_SETTINGS_STORAGE_KEY = "spaceforge-global-ui-settings";

const DEFAULT_GLOBAL_SETTINGS: GlobalEditorUISettings = {
  sidebarDensity: "comfortable",
  keyboardShortcutFeedbackEnabled: true,
};

export function loadGlobalSettings(): GlobalEditorUISettings {
  if (typeof window === "undefined") {
    return DEFAULT_GLOBAL_SETTINGS;
  }

  try {
    const stored = window.localStorage.getItem(GLOBAL_SETTINGS_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_GLOBAL_SETTINGS;
    }

    const parsed = JSON.parse(stored);
    return {
      sidebarDensity: validateSidebarDensity(parsed.sidebarDensity),
      keyboardShortcutFeedbackEnabled: validateKeyboardShortcutFeedback(
        parsed.keyboardShortcutFeedbackEnabled
      ),
    };
  } catch (error) {
    console.error("Failed to load global settings from localStorage", error);
    return DEFAULT_GLOBAL_SETTINGS;
  }
}

export function saveGlobalSettings(settings: Partial<GlobalEditorUISettings>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = loadGlobalSettings();
    const next: GlobalEditorUISettings = {
      ...current,
      ...settings,
    };

    window.localStorage.setItem(GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to save global settings to localStorage", error);
  }
}

function validateSidebarDensity(value: unknown): "comfortable" | "compact" {
  return value === "compact" ? "compact" : "comfortable";
}

function validateKeyboardShortcutFeedback(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}
