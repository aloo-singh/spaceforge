"use client";

import { useEditorStore } from "@/stores/editorStore";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { Button } from "@/components/ui/button";
import type { SubscriptionTier } from "@/lib/subscription/tiers";
import {
  getFeatureConfig,
  getNextTierWithMoreCapacity,
  formatWithLabel,
} from "@/lib/subscription/features";

type TierLimitUpsellDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureKey: string; // e.g., "floors"
  currentTier: SubscriptionTier;
};

export function TierLimitUpsellDialog({
  open,
  onOpenChange,
  featureKey,
  currentTier,
}: TierLimitUpsellDialogProps) {
  const setDevSubscriptionTier = useEditorStore((state) => state.setDevSubscriptionTier);

  const currentConfig = getFeatureConfig(currentTier, featureKey);
  const nextTier = getNextTierWithMoreCapacity(currentTier, featureKey);
  const nextConfig = nextTier ? getFeatureConfig(nextTier, featureKey) : null;

  if (!currentConfig) {
    return null;
  }

  const currentLimitText = formatWithLabel(
    currentConfig.limit,
    currentConfig.singularLabel,
    currentConfig.pluralLabel
  );

  const nextLimitText = nextConfig
    ? formatWithLabel(
        nextConfig.limit,
        nextConfig.singularLabel,
        nextConfig.pluralLabel
      )
    : null;

  const upsellText = nextTier && nextConfig ? currentConfig.upsellMessage(nextTier, nextConfig.limit) : null;
  const hasUpgradePath = !!nextTier;

  return (
    <ResponsiveAlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${currentConfig.name} limit reached`}
      description={`You've reached your current limit of ${currentLimitText}.`}
      footer={
        <div className="flex items-center gap-2">
          {!hasUpgradePath ? (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Got it
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Stay with {currentTier}
              </Button>
              <Button
                onClick={() => {
                  // In dev mode, allow tier switching for testing
                  const isDevMode = useEditorStore.getState().isDevSubscriptionModeEnabled;
                  if (isDevMode) {
                    setDevSubscriptionTier(nextTier);
                    onOpenChange(false);
                  } else {
                    // In production, this would navigate to upgrade flow
                    window.open("/upgrade", "_blank");
                  }
                }}
              >
                Upgrade to {nextTier}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-3 py-4">
        {nextTier && nextLimitText && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>{nextTier}</strong> tier offers up to <strong>{nextLimitText}</strong>.
            </p>
          </div>
        )}
        {upsellText && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {upsellText}
          </p>
        )}
        {!hasUpgradePath && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {currentConfig.terminalMessage}
          </p>
        )}
      </div>
    </ResponsiveAlertDialog>
  );
}
