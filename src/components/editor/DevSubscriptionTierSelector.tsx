"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";

type SubscriptionTier = "Free" | "Pro" | "Studio" | "Education";

type DevSubscriptionTierSelectorProps = {
  onTierChange?: (tier: SubscriptionTier) => void;
  className?: string;
};

const TIERS: SubscriptionTier[] = ["Free", "Pro", "Studio", "Education"];

export function DevSubscriptionTierSelector({
  onTierChange,
  className,
}: DevSubscriptionTierSelectorProps) {
  const isDevSubscriptionModeEnabled = useEditorStore(
    (state) => state.isDevSubscriptionModeEnabled
  );
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("Free");

  // Don't render if dev mode is not enabled
  if (!isDevSubscriptionModeEnabled) {
    return null;
  }

  const handleTierChange = (value: string) => {
    const tier = value as SubscriptionTier;
    setSelectedTier(tier);
    onTierChange?.(tier);
  };

  return (
    <Tabs value={selectedTier} onValueChange={handleTierChange} className={cn("flex-1 flex justify-center", className)}>
      <TabsList className="h-auto gap-1 bg-background/50 p-0.5">
        {TIERS.map((tier) => (
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
