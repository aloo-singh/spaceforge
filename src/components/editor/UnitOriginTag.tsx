"use client";

import { Badge } from "@/components/ui/badge";
import { normalizeUnitOrigin, type UnitOrigin } from "@/lib/projects/region";
import { cn } from "@/lib/utils";

type UnitOriginTagProps = {
  unitOrigin?: UnitOrigin;
  className?: string;
};

export function UnitOriginTag({ unitOrigin, className }: UnitOriginTagProps) {
  const normalizedUnitOrigin = normalizeUnitOrigin(unitOrigin);
  const isImperial = normalizedUnitOrigin === "imperial";

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 shrink-0 rounded-md px-1.5 py-0 text-[10px] font-semibold uppercase tracking-[0.14em]",
        isImperial
          ? "border-fuchsia-300/60 bg-fuchsia-400/10 text-fuchsia-700 dark:border-fuchsia-300/35 dark:bg-fuchsia-300/10 dark:text-fuchsia-200"
          : "border-yellow-300/70 bg-yellow-400/10 text-yellow-700 dark:border-yellow-300/35 dark:bg-yellow-300/10 dark:text-yellow-200",
        className
      )}
    >
      {normalizedUnitOrigin}
    </Badge>
  );
}
