export type EditorThemeMode = "light" | "dark";

export type EditorCanvasTheme = {
  canvasBackground: number;
  gridMinor: number;
  gridMajor: number;
  originAxis: number;
  interactiveAccent: number;
  draftWall: number;
  roomOutline: number;
  roomFill: number;
  roomSelectionOutline: number;
  roomLabelFill: number;
  roomLabelStroke: number;
};

const EDITOR_CANVAS_THEMES: Record<EditorThemeMode, EditorCanvasTheme> = {
  light: {
    canvasBackground: 0xf6f7f9,
    gridMinor: 0xdfe3e8,
    gridMajor: 0xcbd2da,
    originAxis: 0xa8b2be,
    interactiveAccent: 0x2d7ff9,
    draftWall: 0x2d7ff9,
    roomOutline: 0x245fc2,
    roomFill: 0x2d7ff9,
    roomSelectionOutline: 0x2d7ff9,
    roomLabelFill: 0x1b2430,
    roomLabelStroke: 0xf6f7f9,
  },
  dark: {
    canvasBackground: 0x13161a,
    gridMinor: 0x242a31,
    gridMajor: 0x313944,
    originAxis: 0x4b5868,
    interactiveAccent: 0x60a5fa,
    draftWall: 0x60a5fa,
    roomOutline: 0x93c5fd,
    roomFill: 0x60a5fa,
    roomSelectionOutline: 0x60a5fa,
    roomLabelFill: 0xe9edf3,
    roomLabelStroke: 0x13161a,
  },
};

export function resolveEditorThemeMode(resolvedTheme?: string): EditorThemeMode {
  return resolvedTheme === "light" ? "light" : "dark";
}

export function getEditorCanvasTheme(mode: EditorThemeMode): EditorCanvasTheme {
  return EDITOR_CANVAS_THEMES[mode];
}
