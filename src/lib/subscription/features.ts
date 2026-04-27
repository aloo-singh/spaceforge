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
  /** Max allowed value (e.g., 3 for max 3 floors) */
  limit: number;
  /** Singular label (e.g., "floor" not "floors") */
  singularLabel: string;
  /** Plural label (e.g., "floors") */
  pluralLabel: string;
  /**
   * Upsell message fragment. Positive, benefit-focused.
   * Example: "Unlock up to 6 floors and collaborate with your team in Studio."
   */
  upsellMessage: (nextTier: SubscriptionTier, nextLimit: number) => string;
}

/**
 * Complete feature gating configuration by tier.
 */
export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, Record<string, GatedFeatureConfig>> = {
  Free: {
    floors: {
      name: "Floors",
      limit: 1,
      singularLabel: "floor",
      pluralLabel: "floors",
      upsellMessage: (nextTier, nextLimit) => 
        `Upgrade to ${nextTier} to create projects with up to ${nextLimit} ${nextLimit === 1 ? "floor" : "floors"}.`,
    },
  },

  Pro: {
    floors: {
      name: "Floors",
      limit: 3,
      singularLabel: "floor",
      pluralLabel: "floors",
      upsellMessage: (nextTier, nextLimit) =>
        `Unlock ${nextLimit} ${nextLimit === 1 ? "floor" : "floors"} and advanced 3D features with ${nextTier}.`,
    },
  },

  Studio: {
    floors: {
      name: "Floors",
      limit: 6,
      singularLabel: "floor",
      pluralLabel: "floors",
      upsellMessage: (nextTier, nextLimit) =>
        `Education tier allows ${nextLimit} ${nextLimit === 1 ? "floor" : "floors"} and full creative freedom.`,
    },
  },

  Education: {
    floors: {
      name: "Floors",
      limit: 6,
      singularLabel: "floor",
      pluralLabel: "floors",
      upsellMessage: () =>
        `You're on Education tier with full creative freedom.`,
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
