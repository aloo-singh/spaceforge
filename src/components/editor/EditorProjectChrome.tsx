"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { updateProject } from "@/lib/projects/clientApi";
import { getOrCreateAnonymousClientToken } from "@/lib/projects/clientIdentity";
import { Button } from "@/components/ui/button";
import { EarlyExplorerBadge } from "@/components/ui/EarlyExplorerBadge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EditorProjectChromeProps = {
  projectId: string | null;
  projectName: string | null;
  isLoading: boolean;
  isNameHighlighted?: boolean;
  onProjectRenameStart?: () => void;
  onProjectRenameCommitted?: () => void;
  onProjectNameChange: (name: string) => void;
};

export function EditorProjectChrome({
  projectId,
  projectName,
  isLoading,
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

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Button
        asChild
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8 text-foreground/64 hover:bg-muted hover:text-foreground"
      >
        <Link href="/projects" aria-label="Back to projects">
          <ArrowLeft className="size-4" />
        </Link>
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <div data-editor-project-name-anchor className="min-w-0">
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
                "h-8 w-[min(18rem,50vw)] bg-background/90",
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
                "min-w-0 cursor-text rounded-md px-2 py-1 text-left text-sm font-medium tracking-tight text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isNameHighlighted && "bg-blue-500/10 text-white ring-1 ring-blue-500/40"
              )}
              aria-label={`Rename project ${projectName}`}
              title="Rename project"
            >
              <span className="block truncate">{projectName}</span>
            </button>
          ) : null}
        </div>
        {!isEditingName ? <EarlyExplorerBadge /> : null}
      </div>
    </div>
  );
}
