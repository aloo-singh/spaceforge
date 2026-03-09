export type EditorThemeMode = "light" | "dark";

export type EditorCanvasTheme = {
  canvasBackground: number;
  gridMinor: number;
  gridMajor: number;
  originAxis: number;
};

const EDITOR_CANVAS_THEMES: Record<EditorThemeMode, EditorCanvasTheme> = {
  light: {
    canvasBackground: 0xf6f7f9,
    gridMinor: 0xdfe3e8,
    gridMajor: 0xcbd2da,
    originAxis: 0xa8b2be,
  },
  dark: {
    canvasBackground: 0x13161a,
    gridMinor: 0x242a31,
    gridMajor: 0x313944,
    originAxis: 0x4b5868,
  },
};

export function resolveEditorThemeMode(resolvedTheme?: string): EditorThemeMode {
  return resolvedTheme === "light" ? "light" : "dark";
}

export function getEditorCanvasTheme(mode: EditorThemeMode): EditorCanvasTheme {
  return EDITOR_CANVAS_THEMES[mode];
}
