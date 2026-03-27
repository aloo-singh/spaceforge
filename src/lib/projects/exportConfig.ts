export const PROJECT_EXPORT_TITLE_MAX_LENGTH = 80;
export const PROJECT_EXPORT_DESCRIPTION_MAX_LENGTH = 240;

export type ProjectExportTitlePosition = "top" | "none";
export type ProjectExportDescriptionPosition = "below-title" | "none";

export type ProjectExportConfig = {
  title: string;
  description: string;
  titlePosition: ProjectExportTitlePosition;
  descriptionPosition: ProjectExportDescriptionPosition;
};

export const DEFAULT_PROJECT_EXPORT_CONFIG: ProjectExportConfig = {
  title: "",
  description: "",
  titlePosition: "top",
  descriptionPosition: "below-title",
};

export function cloneProjectExportConfig(config: ProjectExportConfig): ProjectExportConfig {
  return {
    title: config.title,
    description: config.description,
    titlePosition: config.titlePosition,
    descriptionPosition: config.descriptionPosition,
  };
}

function normalizeSingleLineText(value: string, maxLength: number) {
  return value.replace(/\r?\n/g, " ").slice(0, maxLength);
}

function normalizeMultilineText(value: string, maxLength: number) {
  return value.replace(/\r\n/g, "\n").slice(0, maxLength);
}

export function normalizeProjectExportConfig(value: unknown): ProjectExportConfig {
  if (typeof value !== "object" || value === null) {
    return cloneProjectExportConfig(DEFAULT_PROJECT_EXPORT_CONFIG);
  }

  return {
    title:
      "title" in value && typeof value.title === "string"
        ? normalizeSingleLineText(value.title, PROJECT_EXPORT_TITLE_MAX_LENGTH)
        : DEFAULT_PROJECT_EXPORT_CONFIG.title,
    description:
      "description" in value && typeof value.description === "string"
        ? normalizeMultilineText(value.description, PROJECT_EXPORT_DESCRIPTION_MAX_LENGTH)
        : DEFAULT_PROJECT_EXPORT_CONFIG.description,
    titlePosition:
      "titlePosition" in value && (value.titlePosition === "top" || value.titlePosition === "none")
        ? value.titlePosition
        : DEFAULT_PROJECT_EXPORT_CONFIG.titlePosition,
    descriptionPosition:
      "descriptionPosition" in value &&
      (value.descriptionPosition === "below-title" || value.descriptionPosition === "none")
        ? value.descriptionPosition
        : DEFAULT_PROJECT_EXPORT_CONFIG.descriptionPosition,
  };
}
