"use client";

import { Button } from "@/components/ui/button";

type ConnectedFloorPromptToastProps = {
  currentFloorName: string;
  canCreateAbove: boolean;
  canCreateBelow: boolean;
  onChoose: (direction: "above" | "below") => void;
  onCancel: () => void;
};

export function ConnectedFloorPromptToast({
  currentFloorName,
  canCreateAbove,
  canCreateBelow,
  onChoose,
  onCancel,
}: ConnectedFloorPromptToastProps) {
  return (
    <div className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-background/96 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.34)]">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Create connected floor above this stair?</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {currentFloorName} stays intact. We&apos;ll mirror this stair onto a new connected floor and switch you there.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onChoose("above")}
          disabled={!canCreateAbove}
          className="rounded-full"
        >
          Above
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChoose("below")}
          disabled={!canCreateBelow}
          className="rounded-full"
        >
          Below
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="rounded-full">
          Cancel
        </Button>
      </div>
      {!canCreateAbove || !canCreateBelow ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {!canCreateAbove && !canCreateBelow
            ? "Connected floors already exist above and below this stair."
            : !canCreateAbove
              ? "Above is unavailable because a higher floor already exists."
              : "Below is unavailable because a lower floor already exists."}
        </p>
      ) : null}
    </div>
  );
}
