"use client";

import { SUBSCRIPTION_FEATURES, type SubscriptionTier } from "@/lib/subscription/features";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TIERS: SubscriptionTier[] = ["Free", "Pro", "Studio", "Education"];

/**
 * Format a limit value for display.
 * Shows "Unlimited" for Infinity, otherwise shows the number.
 */
function formatLimit(limit: number | undefined): string {
  if (limit === undefined || limit === Infinity) {
    return "Unlimited";
  }
  return String(limit);
}

/**
 * Get all unique feature keys across all tiers.
 */
function getAllFeatureKeys(): string[] {
  const keys = new Set<string>();
  for (const tier of TIERS) {
    for (const featureKey of Object.keys(SUBSCRIPTION_FEATURES[tier])) {
      keys.add(featureKey);
    }
  }
  return Array.from(keys).sort();
}

/**
 * Check if a feature has a limit constraint in the Free tier.
 */
function isLimitedInFreeTier(featureKey: string): boolean {
  const freeConfig = SUBSCRIPTION_FEATURES.Free[featureKey];
  const proConfig = SUBSCRIPTION_FEATURES.Pro[featureKey];
  
  if (!freeConfig || !proConfig) return false;
  
  // If Free tier has a lower limit than Pro, it's limited
  return freeConfig.limit < proConfig.limit;
}

export function FeaturesTable() {
  const featureKeys = getAllFeatureKeys();

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border/70 bg-background/90">
      <Table className="w-full">
        <TableHeader className="sticky top-0 z-20 bg-muted/40 backdrop-blur-sm">
          <TableRow className="border-border/70 hover:bg-muted/40">
            {/* Feature column header */}
            <TableHead className="sticky left-0 z-30 w-48 min-w-[12rem] bg-muted/40 px-3 py-3 sm:px-4 sm:py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Feature
            </TableHead>

            {/* Tier headers */}
            {TIERS.map((tier) => (
              <TableHead
                key={tier}
                className="min-w-[110px] px-2 py-3 sm:px-4 sm:py-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {tier}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {featureKeys.map((featureKey) => {
            const isLimited = isLimitedInFreeTier(featureKey);

            return (
              <TableRow
                key={featureKey}
                className={cn(
                  "border-border/70 transition-colors",
                  isLimited
                    ? "bg-amber-50/40 hover:bg-amber-50/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
                    : ""
                )}
              >
                {/* Feature name and description */}
                <TableCell
                  className={cn(
                    "sticky left-0 z-10 min-w-[12rem] px-3 py-3 sm:px-4 sm:py-4 transition-colors",
                    isLimited
                      ? "bg-amber-50/40 dark:bg-amber-950/20"
                      : "bg-background/90"
                  )}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm text-foreground">
                      {SUBSCRIPTION_FEATURES.Free[featureKey]?.label ||
                        SUBSCRIPTION_FEATURES.Free[featureKey]?.name}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {SUBSCRIPTION_FEATURES.Free[featureKey]?.description || ""}
                    </p>
                  </div>
                </TableCell>

                {/* Limit values for each tier */}
                {TIERS.map((tier) => {
                  const config = SUBSCRIPTION_FEATURES[tier][featureKey];
                  const limitValue = config ? formatLimit(config.limit) : "—";

                  return (
                    <TableCell
                      key={`${featureKey}-${tier}`}
                      className="px-2 py-3 sm:px-4 sm:py-4 text-center font-measurement text-sm font-semibold text-foreground"
                    >
                      {limitValue}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
