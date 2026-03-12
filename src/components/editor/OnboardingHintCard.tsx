"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OnboardingHintCardProps = {
  message: string;
  onDismiss: () => void;
  invertedTheme: "light" | "dark";
  className?: string;
};

export function OnboardingHintCard({
  message,
  onDismiss,
  invertedTheme,
  className,
}: OnboardingHintCardProps) {
  const isDarkCard = invertedTheme === "dark";

  return (
    <Card
      className={cn(
        "pointer-events-auto border shadow-lg backdrop-blur-sm",
        isDarkCard
          ? "border-slate-700/90 bg-slate-900/94 text-slate-100 shadow-black/40"
          : "border-slate-300/90 bg-white/96 text-slate-900 shadow-slate-900/20",
        className
      )}
    >
      <CardContent className="flex items-center gap-2 p-2.5 pl-3">
        <p className={cn("text-sm", isDarkCard ? "text-slate-200/90" : "text-slate-700")}>{message}</p>
        <Button
          type="button"
          variant={isDarkCard ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={onDismiss}
          aria-label="Dismiss hint"
          className={cn(
            "ml-auto",
            isDarkCard ? "bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined
          )}
        >
          <X />
        </Button>
      </CardContent>
    </Card>
  );
}
