"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { updateProject } from "@/lib/projects/clientApi";
import { getOrCreateAnonymousClientToken } from "@/lib/projects/clientIdentity";
import { Button } from "@/components/ui/button";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EditorProjectChromeProps = {
  projectId: string | null;
  projectName: string | null;
  isLoading: boolean;
  variant?: "toolbar" | "sidebar";
  isNameHighlighted?: boolean;
  onProjectRenameStart?: () => void;
  onProjectRenameCommitted?: () => void;
  onProjectNameChange: (name: string) => void;
};

export function EditorProjectChrome({
  projectId,
  projectName,
  isLoading,
  variant = "toolbar",
  isNameHighlighted = false,
  onProjectRenameStart,
  onProjectRenameCommitted,
  onProjectNameChange,
}: EditorProjectChromeProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName ?? "");
  const [isSavingName, setIsSavingName] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditingName) return;
    setDraftName(projectName ?? "");
  }, [isEditingName, projectName]);

  useEffect(() => {
    if (!isEditingName) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditingName]);

  const cancelRename = () => {
    setDraftName(projectName ?? "");
    setIsEditingName(false);
  };

  const commitRename = async () => {
    if (!projectId || !projectName || isSavingName) return;

    const nextName = draftName.trim();
    if (!nextName || nextName === projectName) {
      cancelRename();
      return;
    }

    try {
      setIsSavingName(true);
      const clientToken = getOrCreateAnonymousClientToken();
      const project = await updateProject(clientToken, projectId, { name: nextName });
      onProjectNameChange(project.name);
      setIsEditingName(false);
      onProjectRenameCommitted?.();
    } catch {
      inputRef.current?.focus();
    } finally {
      setIsSavingName(false);
    }
  };

  const isSidebar = variant === "sidebar";

  return (
    <div className={cn("min-w-0", isSidebar ? "flex items-center gap-2" : "flex items-center gap-1.5")}>
      <ImmediateTooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                asChild
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  isSidebar
                    ? "size-8 rounded-lg text-foreground/72 hover:bg-muted/80 hover:text-foreground"
                    : "size-8 text-foreground/64 hover:bg-muted hover:text-foreground"
                )}
              >
                <Link href="/projects" aria-label="Back to projects">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center">
            Back to projects
          </TooltipContent>
        </Tooltip>
      </ImmediateTooltipProvider>

      <div data-editor-project-name-anchor className={cn("min-w-0", isSidebar && "flex-1")}>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading project...</div>
        ) : isEditingName ? (
          <Input
            ref={inputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void commitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelRename();
              }
            }}
            onBlur={() => {
              void commitRename();
            }}
            disabled={isSavingName}
            aria-label="Rename project"
            className={cn(
              isSidebar ? "h-9 w-full min-w-0 rounded-lg border-zinc-300/80 bg-zinc-50/90 dark:border-input dark:bg-background" : "h-8 w-[min(18rem,50vw)] bg-background/90",
              isNameHighlighted && "border-blue-500/50 bg-blue-500/10 ring-[3px] ring-blue-500/20"
            )}
          />
        ) : projectName ? (
          <button
            type="button"
            onClick={() => {
              onProjectRenameStart?.();
              setIsEditingName(true);
            }}
            className={cn(
              isSidebar
                ? "h-9 w-full min-w-0 cursor-text rounded-lg border border-transparent px-3 text-left text-base font-medium tracking-tight text-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                : "min-w-0 cursor-text rounded-md px-2 py-1 text-left text-sm font-medium tracking-tight text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isNameHighlighted && "bg-blue-500/10 text-white ring-1 ring-blue-500/40"
            )}
            aria-label={`Rename project ${projectName}`}
          >
            <span className="block leading-none">{projectName}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
