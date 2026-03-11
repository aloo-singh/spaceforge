"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OnboardingHintCardProps = {
  message: string;
  onDismiss: () => void;
  className?: string;
};

export function OnboardingHintCard({ message, onDismiss, className }: OnboardingHintCardProps) {
  return (
    <Card
      className={cn(
        "pointer-events-auto border-border/70 bg-card/90 text-card-foreground shadow-md backdrop-blur-sm",
        className
      )}
    >
      <CardContent className="flex items-center gap-2 p-2.5 pl-3">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          aria-label="Dismiss hint"
          className="ml-auto"
        >
          <X />
        </Button>
      </CardContent>
    </Card>
  );
}
