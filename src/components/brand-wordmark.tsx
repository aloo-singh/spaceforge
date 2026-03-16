import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type BrandWordmarkProps = ComponentPropsWithoutRef<"span">;

export function BrandWordmark({ className, ...props }: BrandWordmarkProps) {
  return (
    <span
      className={cn("font-measurement text-sm font-semibold tracking-tight text-foreground", className)}
      {...props}
    >
      <span className="text-brand">[s]</span>
      <span>paceforge</span>
    </span>
  );
}
