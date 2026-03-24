"use client";

import { useGamificationStore } from "@/stores/useGamificationStore";
import { cn } from "@/lib/utils";

export function EarlyExplorerBadge() {
  const earlyExplorer = useGamificationStore((state) => state.earlyExplorer);
  const hasHydratedEarlyExplorer = useGamificationStore((state) => state.hasHydratedEarlyExplorer);

  if (hasHydratedEarlyExplorer && !earlyExplorer) {
    return null;
  }

  return (
    <span
      className={cn(
        "hidden shrink-0 items-center gap-1 font-measurement text-[10px] font-semibold leading-none tracking-[0.01em] whitespace-nowrap text-foreground/42 sm:inline-flex",
        !hasHydratedEarlyExplorer && "invisible"
      )}
    >
      <span>You found this early</span>
      <span aria-hidden="true" className="size-1.5 rounded-[1px] bg-brand" />
    </span>
  );
}
