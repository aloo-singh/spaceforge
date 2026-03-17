export const ANALYTICS_EVENTS = {
  appOpened: "app_opened",
  editorLoaded: "editor_loaded",
  roomCreated: "room_created",
  firstAction: "first_action",
  firstSuccess: "first_success",
  exportStarted: "export_started",
  exportCompleted: "export_completed",
  roomRenamed: "room_renamed",
  settingsOpened: "settings_opened",
  onboardingStarted: "onboarding_started",
  onboardingCompleted: "onboarding_completed",
  sessionSummary: "session_summary",
  wallSelected: "wall_selected",
  sharedWallDisambiguationUsed: "shared_wall_disambiguation_used",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
