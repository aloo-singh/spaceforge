"use client";

import { SUBSCRIPTION_FEATURES, type SubscriptionTier } from "@/lib/subscription/features";
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

export function FeaturesTable() {
  const featureKeys = getAllFeatureKeys();

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border/70 bg-background/90">
      <Table className="w-full">
        <TableHeader className="sticky top-0 z-20 bg-muted/40 backdrop-blur-sm">
          <TableRow className="border-border/70 hover:bg-muted/40">
            {/* Feature column header */}
            <TableHead className="sticky left-0 z-30 w-48 min-w-[12rem] bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Feature
            </TableHead>

            {/* Tier headers */}
            {TIERS.map((tier) => (
              <TableHead
                key={tier}
                className="min-w-[120px] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {tier}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {featureKeys.map((featureKey) => (
            <TableRow key={featureKey} className="border-border/70">
              {/* Feature name and description */}
              <TableCell className="sticky left-0 z-10 min-w-[12rem] bg-background/90 px-4 py-4">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
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
                    className="px-4 py-4 text-center font-measurement text-sm font-semibold text-foreground"
                  >
                    {limitValue}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
