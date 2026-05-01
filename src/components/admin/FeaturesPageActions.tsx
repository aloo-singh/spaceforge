"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SUBSCRIPTION_FEATURES, type SubscriptionTier } from "@/lib/subscription/features";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import { Copy } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const TIERS: SubscriptionTier[] = ["Free", "Pro", "Studio", "Education"];

export function FeaturesPageActions() {
  const [mounted, setMounted] = useState(false);
  const { devSubscriptionTier, setDevSubscriptionTier } = useEditorStore();
  const [isCopying, setIsCopying] = useState(false);

  // Only render after client hydration to prevent SSR/client mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyAsJson = async () => {
    try {
      setIsCopying(true);
      const jsonString = JSON.stringify(SUBSCRIPTION_FEATURES, null, 2);
      await navigator.clipboard.writeText(jsonString);
      toast.success("Feature config copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    } finally {
      setIsCopying(false);
    }
  };

  const handleTierChange = (value: string) => {
    const tier = value as SubscriptionTier;
    setDevSubscriptionTier(tier);
    toast.success(`Testing as ${tier}`);
  };

  // Don't render tier tabs until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-measurement text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Development
          </p>
          <div className="mt-2 h-8 w-48 animate-pulse rounded bg-muted/30" />
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled
          className="gap-2"
        >
          <Copy className="size-4" />
          Copy as JSON
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-measurement text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Development
        </p>
        <p className="mt-1 text-sm text-foreground/75">
          Currently testing as <span className="font-medium text-foreground">{devSubscriptionTier}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs
          value={devSubscriptionTier}
          onValueChange={handleTierChange}
          className="flex justify-center sm:justify-end"
        >
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

        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyAsJson}
          disabled={isCopying}
          className="gap-2"
        >
          <Copy className="size-4" />
          Copy as JSON
        </Button>
      </div>
    </div>
  );
}
