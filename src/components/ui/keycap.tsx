import * as React from "react";
import { cn } from "@/lib/utils";

type KeycapProps = React.HTMLAttributes<HTMLSpanElement>;

export function Keycap({ className, ...props }: KeycapProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-md border bg-background px-2 text-xs font-medium text-muted-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}
