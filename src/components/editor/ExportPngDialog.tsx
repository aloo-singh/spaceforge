"use client";

import { useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

export type ExportPngThemeOption = "light" | "dark" | "system";

export type ExportPngRequest = {
  showGrid: boolean;
  showDimensions: boolean;
  theme: ExportPngThemeOption;
};

type ExportPngDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (request: ExportPngRequest) => void | Promise<void>;
  isExporting?: boolean;
  exportDisabled?: boolean;
  exportDisabledReason?: string;
  defaultTheme: ExportPngThemeOption;
  currentThemeLabel: "Light" | "Dark";
};

export function ExportPngDialog({
  open,
  onOpenChange,
  onExport,
  isExporting = false,
  exportDisabled = false,
  exportDisabledReason,
  defaultTheme,
  currentThemeLabel,
}: ExportPngDialogProps) {
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [theme, setTheme] = useState<ExportPngThemeOption>(defaultTheme);

  const isExportButtonDisabled = exportDisabled || isExporting;

  const handleExport = () => {
    if (isExportButtonDisabled) return;

    onOpenChange(false);
    void onExport({
      showGrid,
      showDimensions,
      theme,
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Export PNG"
      description="Adjust a few export details without changing the live editor."
      className="sm:w-[min(100%,32rem)] sm:p-4"
      footer={
        <Button
          type="button"
          onClick={handleExport}
          disabled={isExportButtonDisabled}
          title={isExportButtonDisabled ? exportDisabledReason : undefined}
          className="w-full sm:w-auto"
        >
          <Download />
          {isExporting ? "Exporting..." : "Export PNG"}
        </Button>
      }
    >
      <section className="space-y-3">
        <ExportToggleCard
          title="Show grid"
          description="Keep the calm layout grid in the exported image."
          value={showGrid ? "On" : "Off"}
        >
          <BinaryChoice
            ariaLabel="Show grid"
            enabled={showGrid}
            onEnable={() => setShowGrid(true)}
            onDisable={() => setShowGrid(false)}
          />
        </ExportToggleCard>

        <ExportToggleCard
          title="Show dimensions"
          description="Include room measurement text in the PNG without affecting the canvas."
          value={showDimensions ? "On" : "Off"}
        >
          <BinaryChoice
            ariaLabel="Show dimensions"
            enabled={showDimensions}
            onEnable={() => setShowDimensions(true)}
            onDisable={() => setShowDimensions(false)}
          />
        </ExportToggleCard>

        <ExportToggleCard
          title="Export theme"
          description={`Match the current editor theme or choose a fixed look (${currentThemeLabel}).`}
          value={theme === "system" ? `System (${currentThemeLabel})` : theme === "light" ? "Light" : "Dark"}
        >
          <div
            className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-border/70 bg-background/90 p-1"
            role="group"
            aria-label="Export theme"
          >
            <Button
              type="button"
              size="sm"
              variant={theme === "light" ? "secondary" : "ghost"}
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              type="button"
              size="sm"
              variant={theme === "dark" ? "secondary" : "ghost"}
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
            <Button
              type="button"
              size="sm"
              variant={theme === "system" ? "secondary" : "ghost"}
              aria-pressed={theme === "system"}
              onClick={() => setTheme("system")}
            >
              {`System (${currentThemeLabel})`}
            </Button>
          </div>
        </ExportToggleCard>

        <div className="rounded-xl border border-border/70 bg-muted/25 p-3.5">
          <p className="font-measurement text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Designed with
          </p>
          <BrandWordmark className="mt-2 text-base" />
          <p className="mt-1 font-measurement text-[11px] text-muted-foreground">spaceforge.app</p>
        </div>
      </section>
    </ResponsiveDialog>
  );
}

type ExportToggleCardProps = {
  title: string;
  description: string;
  value: string;
  children: ReactNode;
};

function ExportToggleCard({ title, description, value, children }: ExportToggleCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground">
          {value}
        </div>
      </div>
      {children}
    </div>
  );
}

type BinaryChoiceProps = {
  ariaLabel: string;
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
};

function BinaryChoice({ ariaLabel, enabled, onEnable, onDisable }: BinaryChoiceProps) {
  return (
    <div
      className="mt-3 flex w-full rounded-lg border border-border/70 bg-background/90 p-1 sm:inline-flex sm:w-auto"
      role="group"
      aria-label={ariaLabel}
    >
      <Button
        type="button"
        size="sm"
        variant={enabled ? "secondary" : "ghost"}
        aria-pressed={enabled}
        onClick={onEnable}
        className="min-w-20 flex-1 sm:flex-none"
      >
        On
      </Button>
      <Button
        type="button"
        size="sm"
        variant={!enabled ? "secondary" : "ghost"}
        aria-pressed={!enabled}
        onClick={onDisable}
        className="min-w-20 flex-1 sm:flex-none"
      >
        Off
      </Button>
    </div>
  );
}
