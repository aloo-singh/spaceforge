"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorStore } from "@/stores/editorStore";
import { AVAILABLE_TIERS, type SubscriptionTier } from "@/lib/subscription/tiers";
import { cn } from "@/lib/utils";

type DevSubscriptionTierSelectorProps = {
  className?: string;
};

export function DevSubscriptionTierSelector({
  className,
}: DevSubscriptionTierSelectorProps) {
  const [mounted, setMounted] = useState(false);
  const isDevSubscriptionModeEnabled = useEditorStore(
    (state) => state.isDevSubscriptionModeEnabled
  );
  const devSubscriptionTier = useEditorStore(
    (state) => state.devSubscriptionTier
  );
  const setDevSubscriptionTier = useEditorStore(
    (state) => state.setDevSubscriptionTier
  );

  // Only render after client hydration to prevent SSR/client mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render if dev mode is not enabled or not yet mounted
  if (!isDevSubscriptionModeEnabled || !mounted) {
    return null;
  }

  const handleTierChange = (value: string) => {
    const tier = value as SubscriptionTier;
    setDevSubscriptionTier(tier);
  };

  return (
    <Tabs value={devSubscriptionTier} onValueChange={handleTierChange} className={cn("flex-1 flex justify-center", className)}>
      <TabsList className="h-auto gap-1 bg-background/50 p-0.5">
        {AVAILABLE_TIERS.map((tier) => (
          <TabsTrigger
            key={tier}
            value={tier}
            className="text-xs px-2 py-1"
            title={`Test as ${tier} tier`}
          >
            {tier}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
