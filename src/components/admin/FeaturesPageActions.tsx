"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SUBSCRIPTION_FEATURES, type SubscriptionTier } from "@/lib/subscription/features";
import { useEditorStore } from "@/stores/editorStore";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Copy } from "@/components/ui/icons";

const TIERS: SubscriptionTier[] = ["Free", "Pro", "Studio", "Education"];

export function FeaturesPageActions() {
  const { devSubscriptionTier, setDevSubscriptionTier } = useEditorStore();
  const [isCopying, setIsCopying] = useState(false);

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
        <ButtonGroup>
          {TIERS.map((tier) => (
            <div key={tier} data-slot="button-group-item">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDevSubscriptionTier(tier);
                  toast.success(`Testing as ${tier}`);
                }}
                data-state={devSubscriptionTier === tier ? "active" : undefined}
              >
                {tier}
              </Button>
            </div>
          ))}
        </ButtonGroup>

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
