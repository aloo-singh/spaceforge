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
