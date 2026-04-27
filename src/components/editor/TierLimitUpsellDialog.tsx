"use client";

import { useEditorStore } from "@/stores/editorStore";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { Button } from "@/components/ui/button";
import { getTierConfig, AVAILABLE_TIERS, type SubscriptionTier } from "@/lib/subscription/tiers";

type TierLimitUpsellDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string; // e.g., "Floors"
  currentTier: SubscriptionTier;
  currentLimit: number;
};

export function TierLimitUpsellDialog({
  open,
  onOpenChange,
  feature,
  currentTier,
  currentLimit,
}: TierLimitUpsellDialogProps) {
  const setDevSubscriptionTier = useEditorStore((state) => state.setDevSubscriptionTier);

  // Find the next tier that offers more of this feature
  const currentTierIndex = AVAILABLE_TIERS.indexOf(currentTier);
  const nextTierWithMore = AVAILABLE_TIERS.slice(currentTierIndex + 1).find((tier) => {
    const config = getTierConfig(tier);
    return config.maxFloors > currentLimit;
  });

  const nextTierConfig = nextTierWithMore ? getTierConfig(nextTierWithMore) : null;

  return (
    <ResponsiveAlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${feature} limit reached`}
      description={`You've reached the ${currentLimit}-${feature.toLowerCase()} limit on your current plan.`}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep current
          </Button>
          {nextTierWithMore && (
            <Button
              onClick={() => {
                // In dev mode, allow tier switching for testing
                const isDevMode = useEditorStore.getState().isDevSubscriptionModeEnabled;
                if (isDevMode) {
                  setDevSubscriptionTier(nextTierWithMore);
                  onOpenChange(false);
                } else {
                  // In production, this would navigate to upgrade flow
                  window.open("/upgrade", "_blank");
                }
              }}
            >
              Upgrade to {nextTierWithMore}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3 py-4">
        {nextTierWithMore && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>{nextTierWithMore}</strong> tier offers up to{" "}
              <strong>{nextTierConfig?.maxFloors}</strong> {feature.toLowerCase()}.
            </p>
          </div>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Upgrade your plan to unlock more {feature.toLowerCase()} and other premium features.
        </p>
      </div>
    </ResponsiveAlertDialog>
  );
}
