"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const label = "Toggle color theme";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={() => setTheme(nextTheme)}
      aria-label={label}
      title={label}
      className={cn(
        "bg-background/85 text-foreground/75 shadow-md backdrop-blur-sm hover:text-foreground",
        className
      )}
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
