export const ANALYTICS_EVENTS = {
  appOpened: "app_opened",
  roomCreated: "room_created",
  firstAction: "first_action",
  firstSuccess: "first_success",
  exportStarted: "export_started",
  exportCompleted: "export_completed",
  roomRenamed: "room_renamed",
  settingsOpened: "settings_opened",
  onboardingStarted: "onboarding_started",
  onboardingCompleted: "onboarding_completed",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
