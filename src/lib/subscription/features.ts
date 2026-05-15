/**
 * Subscription Feature Gating
 *
 * Single source of truth for all gated features, limits, and upsell messaging.
 * All messaging is benefit-focused and inviting (not restriction-focused).
 */

export type SubscriptionTier = "Free" | "Pro" | "Studio" | "Education";

/**
 * Metadata for a gated feature or limit.
 */
export interface GatedFeatureConfig {
  /** Feature name for display */
  name: string;
  /** Short human-readable label for the feature */
  label?: string;
  /** Benefit-focused description of the feature */
  description?: string;
  /** Max allowed value (e.g., 3 for max 3 floors) */
  limit: number;
  /** Singular label (e.g., "floor" not "floors") */
  singularLabel: string;
  /** Plural label (e.g., "floors") */
  pluralLabel: string;
  /**
   * Upsell message fragment when upgrade is available.
   * Positive, benefit-focused. Example: "Unlock up to 6 floors and collaborate with your team in Studio."
   */
  upsellMessage: (nextTier: SubscriptionTier, nextLimit: number) => string;
  /**
   * Terminal message when at the highest tier with no upgrade path.
   * Rory-approved: focus on what's possible, celebration of tier, not restriction.
   */
  terminalMessage: string;
}

/**
 * Complete feature gating configuration by tier.
 */
export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, Record<string, GatedFeatureConfig>> = {
  Free: {
    floors: {
      name: "Floors",
      label: "Floors per project",
      description: "Build multi-story projects with multiple floors in a single design.",
      limit: 1,
      singularLabel: "floor",
      pluralLabel: "floors",
      upsellMessage: (nextTier, nextLimit) => 
        `Upgrade to ${nextTier} to create projects with up to ${nextLimit} ${nextLimit === 1 ? "floor" : "floors"}.`,
      terminalMessage: "You've reached your Free tier limit. Ready to expand your creativity?",
    },
    projects: {
      name: "Projects",
      label: "Projects",
      description: "Create and organize multiple floor plan projects.",
      limit: 2,
      singularLabel: "project",
      pluralLabel: "projects",
      upsellMessage: (nextTier, nextLimit) =>
        `Upgrade to ${nextTier} to create unlimited projects and unlock advanced features.`,
      terminalMessage: "You've reached your Free tier project limit. Ready to expand?",
    },
    projectFilters: {
      name: "Project Filters",
      label: "Project filters",
      description: "Filter the projects page by project details.",
      limit: 2,
      singularLabel: "filter",
      pluralLabel: "filters",
      upsellMessage: (nextTier, nextLimit) =>
        `Upgrade to ${nextTier} to use ${nextLimit} project filters, including floors.`,
      terminalMessage: "Free includes room and area filters. Upgrade when you need floor-level browsing.",
    },
    projectInfoMetrics: {
      name: "Project Info Metrics",
      label: "Project info metrics",
      description: "Show useful project details on project thumbnails.",
      limit: 2,
      singularLabel: "metric",
      pluralLabel: "metrics",
      upsellMessage: (nextTier, nextLimit) =>
        `Upgrade to ${nextTier} to see ${nextLimit} project info metrics, including floors and created date.`,
      terminalMessage: "Free includes room count and total area. Upgrade for richer project details.",
    },
    exportHighRes: {
      name: "Hi-res Export",
      label: "Hi-res PNG export",
      description: "Export floor plans at 4x resolution (5120px) for crystal-clear prints and presentations.",
      limit: 0,
      singularLabel: "resolution level",
      pluralLabel: "resolution levels",
      upsellMessage: (nextTier) =>
        `Upgrade to ${nextTier} to unlock Hi-res export (4x resolution = 16x total pixels for prints that stay sharp at any size).`,
      terminalMessage: "Free tier doesn't include Hi-res export. Upgrade for crisp, sharp prints.",
    },
    exportPdf: {
      name: "PDF Export",
      label: "PDF export",
      description: "Create print-ready PDF exports for sharing plans cleanly.",
      limit: 0,
      singularLabel: "format",
      pluralLabel: "formats",
      upsellMessage: (nextTier) =>
        `Upgrade to ${nextTier} to export print-ready PDFs for sharing and review.`,
      terminalMessage: "Free tier doesn't include PDF export. Upgrade when you need print-ready files.",
    },
    exportSvg: {
      name: "SVG Export",
      label: "SVG export",
      description: "Export editable vector floor plans for design and presentation tools.",
      limit: 0,
      singularLabel: "format",
      pluralLabel: "formats",
      upsellMessage: (nextTier) =>
        `Upgrade to ${nextTier} to export editable SVG files for vector workflows.`,
      terminalMessage: "Free tier doesn't include SVG export. Upgrade for editable vector output.",
    },
    unitOriginHighlight: {
      name: "Unit Origin Highlight",
      label: "Metric / imperial canvas highlight",
      description: "Color-code metric-origin and imperial-origin elements on the canvas.",
      limit: 0,
      singularLabel: "highlight mode",
      pluralLabel: "highlight modes",
      upsellMessage: (nextTier) =>
        `Upgrade to ${nextTier} to highlight metric and imperial-origin elements while reviewing mixed-unit plans.`,
      terminalMessage: "Free includes regional defaults and display units. Pro unlocks mixed-unit highlighting.",
    },
  },

  Pro: {
    floors: {
      name: "Floors",
      label: "Floors per project",
      description: "Design multi-level properties with enhanced architectural flexibility.",
      limit: 3,
      singularLabel: "floor",
      pluralLabel: "floors",
      upsellMessage: (nextTier, nextLimit) =>
        `Unlock ${nextLimit} ${nextLimit === 1 ? "floor" : "floors"} and advanced 3D features with ${nextTier}.`,
      terminalMessage: "Pro tier maxed out. Studio unlocks commercial features and 6 floors.",
    },
    projects: {
      name: "Projects",
      label: "Projects",
      description: "Organize unlimited floor plans across multiple projects.",
      limit: Infinity,
      singularLabel: "project",
      pluralLabel: "projects",
      upsellMessage: () =>
        `You've unlocked unlimited projects on Pro. Create freely.`,
      terminalMessage: "You have unlimited projects on Pro tier. Build away!",
    },
    projectFilters: {
      name: "Project Filters",
      label: "Project filters",
      description: "Filter the projects page by project details.",
      limit: 3,
      singularLabel: "filter",
      pluralLabel: "filters",
      upsellMessage: () =>
        `You've unlocked project filters for rooms, area, and floors on Pro.`,
      terminalMessage: "Project filters for rooms, area, and floors are available on Pro.",
    },
    projectInfoMetrics: {
      name: "Project Info Metrics",
      label: "Project info metrics",
      description: "Show useful project details on project thumbnails.",
      limit: 4,
      singularLabel: "metric",
      pluralLabel: "metrics",
      upsellMessage: () =>
        `You've unlocked the full project info overlay on Pro.`,
      terminalMessage: "The full project info overlay is available on Pro.",
    },
    exportHighRes: {
      name: "Hi-res Export",
      label: "Hi-res PNG export",
      description: "Export floor plans at 4x resolution (5120px) for crystal-clear prints and presentations.",
      limit: 1,
      singularLabel: "resolution level",
      pluralLabel: "resolution levels",
      upsellMessage: () =>
        `You've unlocked Hi-res export on Pro. Export crisp prints at any size.`,
      terminalMessage: "You've unlocked Hi-res export on Pro. Export crisp prints at any size.",
    },
    exportPdf: {
      name: "PDF Export",
      label: "PDF export",
      description: "Create print-ready PDF exports for sharing plans cleanly.",
      limit: 1,
      singularLabel: "format",
      pluralLabel: "formats",
      upsellMessage: () =>
        `You've unlocked PDF export on Pro. Create print-ready plans for sharing and review.`,
      terminalMessage: "You've unlocked PDF export on Pro. Create print-ready plans for sharing and review.",
    },
    exportSvg: {
      name: "SVG Export",
      label: "SVG export",
      description: "Export editable vector floor plans for design and presentation tools.",
      limit: 0,
      singularLabel: "format",
      pluralLabel: "formats",
      upsellMessage: (nextTier) =>
        `Upgrade to ${nextTier} to export editable SVG files for vector workflows.`,
      terminalMessage: "Pro includes PDF export. Studio unlocks editable SVG export.",
    },
    unitOriginHighlight: {
      name: "Unit Origin Highlight",
      label: "Metric / imperial canvas highlight",
      description: "Color-code metric-origin and imperial-origin elements on the canvas.",
      limit: 1,
      singularLabel: "highlight mode",
      pluralLabel: "highlight modes",
      upsellMessage: () =>
        `You've unlocked metric and imperial-origin highlighting on Pro.`,
      terminalMessage: "Metric and imperial-origin highlighting is available on Pro.",
    },
  },

  Studio: {
    floors: {
      name: "Floors",
      label: "Floors per project",
      description: "Create complex multi-level designs with full creative freedom.",
      limit: 6,
      singularLabel: "floor",
      pluralLabel: "floors",
      upsellMessage: (nextTier, nextLimit) =>
        `Unlock ${nextLimit} ${nextLimit === 1 ? "floor" : "floors"} with ${nextTier}.`,
      terminalMessage: "You've unlocked Studio's full creative potential. Make every floor count.",
    },
    projects: {
      name: "Projects",
      label: "Projects",
      description: "Organize unlimited projects for professional workflow.",
      limit: Infinity,
      singularLabel: "project",
      pluralLabel: "projects",
      upsellMessage: () =>
        `You've unlocked unlimited projects on Studio. Create freely.`,
      terminalMessage: "You have unlimited projects on Studio tier. Build away!",
    },
    projectFilters: {
      name: "Project Filters",
      label: "Project filters",
      description: "Filter the projects page by project details.",
      limit: 3,
      singularLabel: "filter",
      pluralLabel: "filters",
      upsellMessage: () =>
        `You've unlocked project filters for rooms, area, and floors on Studio.`,
      terminalMessage: "Project filters for rooms, area, and floors are available on Studio.",
    },
    projectInfoMetrics: {
      name: "Project Info Metrics",
      label: "Project info metrics",
      description: "Show useful project details on project thumbnails.",
      limit: 4,
      singularLabel: "metric",
      pluralLabel: "metrics",
      upsellMessage: () =>
        `You've unlocked the full project info overlay on Studio.`,
      terminalMessage: "The full project info overlay is available on Studio.",
    },
    exportHighRes: {
      name: "Hi-res Export",
      label: "Hi-res PNG export",
      description: "Export floor plans at 4x resolution (5120px) for crystal-clear prints and presentations.",
      limit: 1,
      singularLabel: "resolution level",
      pluralLabel: "resolution levels",
      upsellMessage: () =>
        `You've unlocked Hi-res export on Studio. Export crisp prints at any size.`,
      terminalMessage: "You've unlocked Hi-res export on Studio. Export crisp prints at any size.",
    },
    exportPdf: {
      name: "PDF Export",
      label: "PDF export",
      description: "Create print-ready PDF exports for sharing plans cleanly.",
      limit: 1,
      singularLabel: "format",
      pluralLabel: "formats",
      upsellMessage: () =>
        `You've unlocked PDF export on Studio. Create print-ready plans for sharing and review.`,
      terminalMessage: "You've unlocked PDF export on Studio. Create print-ready plans for sharing and review.",
    },
    exportSvg: {
      name: "SVG Export",
      label: "SVG export",
      description: "Export editable vector floor plans for design and presentation tools.",
      limit: 1,
      singularLabel: "format",
      pluralLabel: "formats",
      upsellMessage: () =>
        `You've unlocked editable SVG export on Studio.`,
      terminalMessage: "You've unlocked editable SVG export on Studio.",
    },
    unitOriginHighlight: {
      name: "Unit Origin Highlight",
      label: "Metric / imperial canvas highlight",
      description: "Color-code metric-origin and imperial-origin elements on the canvas.",
      limit: 1,
      singularLabel: "highlight mode",
      pluralLabel: "highlight modes",
      upsellMessage: () =>
        `You've unlocked metric and imperial-origin highlighting on Studio.`,
      terminalMessage: "Metric and imperial-origin highlighting is available on Studio.",
    },
  },

  Education: {
    floors: {
      name: "Floors",
      label: "Floors per project",
      description: "Explore multi-level design with comprehensive creative capabilities.",
      limit: 6,
      singularLabel: "floor",
      pluralLabel: "floors",
      upsellMessage: () =>
        `You're on Education tier with full creative freedom.`,
      terminalMessage: "Education tier gives you 6 floors of unlimited creative freedom. You've got this.",
    },
    projects: {
      name: "Projects",
      label: "Projects",
      description: "Build unlimited projects for coursework and exploration.",
      limit: Infinity,
      singularLabel: "project",
      pluralLabel: "projects",
      upsellMessage: () =>
        `You've unlocked unlimited projects on Education. Create freely.`,
      terminalMessage: "You have unlimited projects on Education tier. Build away!",
    },
    projectFilters: {
      name: "Project Filters",
      label: "Project filters",
      description: "Filter the projects page by project details.",
      limit: 3,
      singularLabel: "filter",
      pluralLabel: "filters",
      upsellMessage: () =>
        `You're on Education tier with full project filtering.`,
      terminalMessage: "Project filters for rooms, area, and floors are available on Education.",
    },
    projectInfoMetrics: {
      name: "Project Info Metrics",
      label: "Project info metrics",
      description: "Show useful project details on project thumbnails.",
      limit: 4,
      singularLabel: "metric",
      pluralLabel: "metrics",
      upsellMessage: () =>
        `You're on Education tier with the full project info overlay.`,
      terminalMessage: "The full project info overlay is available on Education.",
    },
    exportHighRes: {
      name: "Hi-res Export",
      label: "Hi-res PNG export",
      description: "Export floor plans at 4x resolution (5120px) for crystal-clear prints and presentations.",
      limit: 1,
      singularLabel: "resolution level",
      pluralLabel: "resolution levels",
      upsellMessage: () =>
        `You've unlocked Hi-res export on Education. Export crisp prints at any size.`,
      terminalMessage: "You've unlocked Hi-res export on Education. Export crisp prints at any size.",
    },
    exportPdf: {
      name: "PDF Export",
      label: "PDF export",
      description: "Create print-ready PDF exports for sharing plans cleanly.",
      limit: 1,
      singularLabel: "format",
      pluralLabel: "formats",
      upsellMessage: () =>
        `You're on Education tier with PDF export unlocked.`,
      terminalMessage: "PDF export is available on Education.",
    },
    exportSvg: {
      name: "SVG Export",
      label: "SVG export",
      description: "Export editable vector floor plans for design and presentation tools.",
      limit: 1,
      singularLabel: "format",
      pluralLabel: "formats",
      upsellMessage: () =>
        `You're on Education tier with editable SVG export unlocked.`,
      terminalMessage: "Editable SVG export is available on Education.",
    },
    unitOriginHighlight: {
      name: "Unit Origin Highlight",
      label: "Metric / imperial canvas highlight",
      description: "Color-code metric-origin and imperial-origin elements on the canvas.",
      limit: 1,
      singularLabel: "highlight mode",
      pluralLabel: "highlight modes",
      upsellMessage: () =>
        `You're on Education tier with metric and imperial-origin highlighting unlocked.`,
      terminalMessage: "Metric and imperial-origin highlighting is available on Education.",
    },
  },
};

/**
 * Get feature config for a tier.
 * Safely returns config or defaults to Free tier if invalid.
 */
export function getFeatureConfig(
  tier: SubscriptionTier | string,
  feature: string
): GatedFeatureConfig | null {
  const tierConfig = SUBSCRIPTION_FEATURES[tier as SubscriptionTier];
  if (!tierConfig) {
    return SUBSCRIPTION_FEATURES.Free[feature] ?? null;
  }
  return tierConfig[feature] ?? null;
}

/**
 * Format a number with singular/plural label.
 * Example: formatWithLabel(1, "floor", "floors") → "1 floor"
 * Example: formatWithLabel(3, "floor", "floors") → "3 floors"
 */
export function formatWithLabel(
  count: number,
  singularLabel: string,
  pluralLabel: string
): string {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

/**
 * Get the next tier that has a higher limit for a feature.
 * Useful for upsell flows.
 */
export function getNextTierWithMoreCapacity(
  currentTier: SubscriptionTier,
  feature: string
): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ["Free", "Pro", "Studio", "Education"];
  const currentIndex = tiers.indexOf(currentTier);
  
  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null;
  }

  const currentConfig = getFeatureConfig(currentTier, feature);
  if (!currentConfig) return null;

  for (let i = currentIndex + 1; i < tiers.length; i++) {
    const nextTier = tiers[i];
    const nextConfig = getFeatureConfig(nextTier, feature);
    if (nextConfig && nextConfig.limit > currentConfig.limit) {
      return nextTier;
    }
  }

  return null;
}

/**
 * Get the next tier's limit for a feature.
 */
export function getNextTierLimit(currentTier: SubscriptionTier, feature: string): number | null {
  const nextTier = getNextTierWithMoreCapacity(currentTier, feature);
  if (!nextTier) return null;
  
  const nextConfig = getFeatureConfig(nextTier, feature);
  return nextConfig?.limit ?? null;
}

/**
 * Get the effective max projects for a subscription tier.
 * Safely handles "unlimited" by returning Infinity.
 */
export function getEffectiveMaxProjects(tier: SubscriptionTier | string): number {
  const config = getFeatureConfig(tier, "projects");
  if (!config) {
    // Default to Free tier limit if tier not found
    return 2;
  }
  return config.limit;
}
