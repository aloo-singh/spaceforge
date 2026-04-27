/**
 * Subscription Tier Definitions
 *
 * Single source of truth for all subscription features, limits, and gating.
 *
 * Pricing principle:
 * Free = build and explore
 * Paid = present and scale
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
  hasRegionalSettings: boolean;

  /** 2D / 2.5D visualisation */
  has2DPlanView: boolean;
  has2_5DVisualisation: boolean;

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

  /**
   * Branding / agency
   *
   * Custom branding = personal/project-level design identity.
   * Useful for Education users to personalise and share their work.
   *
   * White labelling, brand templates, and client brand profiles are Studio-only
   * because they are B2B/commercial agency features.
   */
  hasCustomBranding: boolean;
  hasWhiteLabelExports: boolean;
  hasBrandTemplates: boolean;
  hasClientBrandProfiles: boolean;

  /** Saving, sharing & collaboration */
  hasCloudSync: boolean;
  hasShareLinks: boolean;
  hasPrivateShareLinks: boolean;
  hasVersionHistory: boolean;
  hasCollaboration: boolean;

  /** Gallery / community */
  canPublishToGallery: boolean;
  canDuplicateGalleryProjects: boolean;

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
    hasRegionalSettings: true,

    // 2D / 2.5D
    has2DPlanView: true,
    has2_5DVisualisation: true,

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

    // Branding / agency
    hasCustomBranding: false,
    hasWhiteLabelExports: false,
    hasBrandTemplates: false,
    hasClientBrandProfiles: false,

    // Saving / sharing
    hasCloudSync: false,
    hasShareLinks: true,
    hasPrivateShareLinks: false,
    hasVersionHistory: false,
    hasCollaboration: false,

    // Gallery
    canPublishToGallery: true,
    canDuplicateGalleryProjects: true,

    // Pro workflows
    exportCAD: false,
    hasBatchExport: false,
    hasPriorityProcessing: false,
  },

  Pro: {
    // Layout
    maxFloors: 3,
    maxProjects: "unlimited",

    hasMultiFloor: true,
    hasStairLinking: true,

    // Measurements
    hasAdvancedMeasurements: true,
    hasRegionalSettings: true,

    // 2D / 2.5D
    has2DPlanView: true,
    has2_5DVisualisation: true,

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

    // Branding / agency
    hasCustomBranding: false,
    hasWhiteLabelExports: false,
    hasBrandTemplates: false,
    hasClientBrandProfiles: false,

    // Saving / sharing
    hasCloudSync: true,
    hasShareLinks: true,
    hasPrivateShareLinks: true,
    hasVersionHistory: false,
    hasCollaboration: false,

    // Gallery
    canPublishToGallery: true,
    canDuplicateGalleryProjects: true,

    // Pro workflows
    exportCAD: false,
    hasBatchExport: false,
    hasPriorityProcessing: false,
  },

  Studio: {
    // Layout
    maxFloors: 6,
    maxProjects: "unlimited",

    hasMultiFloor: true,
    hasStairLinking: true,

    // Measurements
    hasAdvancedMeasurements: true,
    hasRegionalSettings: true,

    // 2D / 2.5D
    has2DPlanView: true,
    has2_5DVisualisation: true,

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

    // Branding / agency
    hasCustomBranding: true,
    hasWhiteLabelExports: true,
    hasBrandTemplates: true,
    hasClientBrandProfiles: true,

    // Saving / sharing
    hasCloudSync: true,
    hasShareLinks: true,
    hasPrivateShareLinks: true,
    hasVersionHistory: true,
    hasCollaboration: true,

    // Gallery
    canPublishToGallery: true,
    canDuplicateGalleryProjects: true,

    // Pro workflows
    exportCAD: true,
    hasBatchExport: true,
    hasPriorityProcessing: true,
  },

  Education: {
    // Layout
    maxFloors: 6,
    maxProjects: "unlimited",

    hasMultiFloor: true,
    hasStairLinking: true,

    // Measurements
    hasAdvancedMeasurements: true,
    hasRegionalSettings: true,

    // 2D / 2.5D
    has2DPlanView: true,
    has2_5DVisualisation: true,

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

    // Branding / agency
    hasCustomBranding: true,
    hasWhiteLabelExports: false,
    hasBrandTemplates: false,
    hasClientBrandProfiles: false,

    // Saving / sharing
    hasCloudSync: true,
    hasShareLinks: true,
    hasPrivateShareLinks: true,
    hasVersionHistory: true,
    hasCollaboration: false,

    // Gallery
    canPublishToGallery: true,
    canDuplicateGalleryProjects: true,

    // Pro workflows
    exportCAD: true,
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