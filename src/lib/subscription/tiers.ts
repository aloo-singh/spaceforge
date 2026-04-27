/**
 * Subscription Tier Definitions
 *
 * Single source of truth for all subscription features, limits, and gating.
 */

export type SubscriptionTier = "Free" | "Pro" | "Studio" | "Education";

/**
 * Tier feature/limit configuration.
 */
export interface TierConfig {
  /** Layout limits */
  maxFloors: number;
  maxProjects: number | "unlimited";

  /** Core capabilities */
  hasMultiFloor: boolean;
  hasStairLinking: boolean;

  /** Measurement & precision */
  hasAdvancedMeasurements: boolean;

  /** Floor plan output */
  exportPNG: boolean;
  exportHighRes: boolean;
  exportPDF: boolean;
  exportSVG: boolean;
  hasMultiplePlanStyles: boolean;

  /** 3D & visualisation */
  has3DWalkthrough: boolean;
  hasAdvanced3DRendering: boolean;
  export3DImages: boolean;

  /** Branding / agency */
  hasCustomBranding: boolean;
  hasBrandTemplates: boolean;

  /** Saving & collaboration */
  hasCloudSync: boolean;
  hasShareLinks: boolean;
  hasVersionHistory: boolean;

  /** Pro workflows */
  exportCAD: boolean;
  hasBatchExport: boolean;
  hasPriorityProcessing: boolean;
}

/**
 * Complete tier configuration map.
 */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  Free: {
    // Layout
    maxFloors: 1,
    maxProjects: 2,

    hasMultiFloor: false,
    hasStairLinking: false,

    // Measurements
    hasAdvancedMeasurements: false,

    // Output
    exportPNG: true,
    exportHighRes: false,
    exportPDF: false,
    exportSVG: false,
    hasMultiplePlanStyles: false,

    // 3D
    has3DWalkthrough: false,
    hasAdvanced3DRendering: false,
    export3DImages: false,

    // Branding
    hasCustomBranding: false,
    hasBrandTemplates: false,

    // Saving
    hasCloudSync: false,
    hasShareLinks: false,
    hasVersionHistory: false,

    // Pro workflows
    exportCAD: false,
    hasBatchExport: false,
    hasPriorityProcessing: false,
  },

  Pro: {
    // Layout
    maxFloors: 5,
    maxProjects: "unlimited",

    hasMultiFloor: true,
    hasStairLinking: true,

    // Measurements
    hasAdvancedMeasurements: true,

    // Output
    exportPNG: true,
    exportHighRes: true,
    exportPDF: true,
    exportSVG: false,
    hasMultiplePlanStyles: true,

    // 3D
    has3DWalkthrough: true,
    hasAdvanced3DRendering: true,
    export3DImages: false,

    // Branding
    hasCustomBranding: false,
    hasBrandTemplates: false,

    // Saving
    hasCloudSync: true,
    hasShareLinks: true,
    hasVersionHistory: false,

    // Pro workflows
    exportCAD: false,
    hasBatchExport: false,
    hasPriorityProcessing: false,
  },

  Studio: {
    // Layout
    maxFloors: 10,
    maxProjects: "unlimited",

    hasMultiFloor: true,
    hasStairLinking: true,

    // Measurements
    hasAdvancedMeasurements: true,

    // Output
    exportPNG: true,
    exportHighRes: true,
    exportPDF: true,
    exportSVG: true,
    hasMultiplePlanStyles: true,

    // 3D
    has3DWalkthrough: true,
    hasAdvanced3DRendering: true,
    export3DImages: true,

    // Branding
    hasCustomBranding: true,
    hasBrandTemplates: true,

    // Saving
    hasCloudSync: true,
    hasShareLinks: true,
    hasVersionHistory: true,

    // Pro workflows
    exportCAD: true,
    hasBatchExport: true,
    hasPriorityProcessing: true,
  },

  Education: {
    // Layout
    maxFloors: 10,
    maxProjects: "unlimited",

    hasMultiFloor: true,
    hasStairLinking: true,

    // Measurements
    hasAdvancedMeasurements: true,

    // Output
    exportPNG: true,
    exportHighRes: true,
    exportPDF: true,
    exportSVG: true,
    hasMultiplePlanStyles: true,

    // 3D
    has3DWalkthrough: true,
    hasAdvanced3DRendering: true,
    export3DImages: false, // optional restriction

    // Branding
    hasCustomBranding: false, // keep Studio as B2B tier
    hasBrandTemplates: false,

    // Saving
    hasCloudSync: true,
    hasShareLinks: true,
    hasVersionHistory: false,

    // Pro workflows
    exportCAD: false,
    hasBatchExport: false,
    hasPriorityProcessing: false,
  },
} as const;

/**
 * Get tier configuration by tier name.
 */
export function getTierConfig(tier: SubscriptionTier | string): TierConfig {
  if (tier in SUBSCRIPTION_TIERS) {
    return SUBSCRIPTION_TIERS[tier as SubscriptionTier];
  }
  return SUBSCRIPTION_TIERS.Free;
}

/**
 * List of all available tiers in deterministic order.
 */
export const AVAILABLE_TIERS: SubscriptionTier[] = [
  "Free",
  "Pro",
  "Studio",
  "Education",
] as const;