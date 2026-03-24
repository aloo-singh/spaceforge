import * as React from "react";
import { cn } from "@/lib/utils";

type KeycapProps = React.HTMLAttributes<HTMLSpanElement>;

type KeycapComboProps = React.HTMLAttributes<HTMLSpanElement> & {
  keys: React.ReactNode[];
  keyClassName?: string;
  separator?: React.ReactNode;
  separatorClassName?: string;
};

export function Keycap({ className, ...props }: KeycapProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/70 bg-muted/55 px-1.5 font-measurement text-[11px] font-medium leading-none text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
        className
      )}
      {...props}
    />
  );
}

export function KeycapCombo({
  className,
  keyClassName,
  keys,
  separator = "+",
  separatorClassName,
  ...props
}: KeycapComboProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} {...props}>
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 ? (
            <span className={cn("font-measurement text-[10px] text-muted-foreground/70", separatorClassName)}>
              {separator}
            </span>
          ) : null}
          <Keycap className={keyClassName}>{key}</Keycap>
        </React.Fragment>
      ))}
    </span>
  );
}
