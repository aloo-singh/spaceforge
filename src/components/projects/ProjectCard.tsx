"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Clock3, PencilLine, Trash2, X } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects/types";
import { formatProjectUpdatedAt } from "@/lib/projects/formatting";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProjectCardProps = {
  project: ProjectListItem;
  onRename: (projectId: string, name: string) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
  isRenaming: boolean;
  isDeleting: boolean;
  isInteractionDisabled?: boolean;
};

export function ProjectCard({
  project,
  onRename,
  onDelete,
  isRenaming,
  isDeleting,
  isInteractionDisabled = false,
}: ProjectCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRenameRef = useRef(false);
  const isDeletingProject = isDeleting || isInteractionDisabled;

  useEffect(() => {
    if (isEditingName) return;
    setDraftName(project.name);
  }, [isEditingName, project.name]);

  useEffect(() => {
    if (!isEditingName) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditingName]);

  useEffect(() => {
    if (!isDeleting) return;
    setIsEditingName(false);
  }, [isDeleting]);

  const finishRename = async () => {
    if (isSubmittingRenameRef.current || isInteractionDisabled || isConfirmingDelete) return;

    const nextName = draftName.trim();
    if (!nextName) {
      setDraftName(project.name);
      setIsEditingName(false);
      return;
    }

    if (nextName === project.name) {
      setIsEditingName(false);
      return;
    }

    try {
      isSubmittingRenameRef.current = true;
      await onRename(project.id, nextName);
      setIsEditingName(false);
    } catch {
      inputRef.current?.focus();
    } finally {
      isSubmittingRenameRef.current = false;
    }
  };

  const cancelRename = () => {
    if (isRenaming || isDeleting) return;
    setDraftName(project.name);
    setIsEditingName(false);
  };

  const startDeleteConfirmation = () => {
    if (isInteractionDisabled || isRenaming || isDeleting) return;
    setDraftName(project.name);
    setIsEditingName(false);
    setIsConfirmingDelete(true);
  };

  const cancelDeleteConfirmation = () => {
    if (isDeleting) return;
    setIsConfirmingDelete(false);
  };

  const confirmDelete = async () => {
    if (isDeletingProject) return;

    try {
      await onDelete(project.id);
    } catch {
      setIsConfirmingDelete(true);
    }
  };

  return (
    <Card className="border-border/70 bg-card/75 transition-colors hover:border-border hover:bg-card/95">
      <CardContent className="flex h-full flex-col gap-5 p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              {isEditingName ? (
                <div className="space-y-2">
                  <Input
                    ref={inputRef}
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void finishRename();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                    onBlur={() => {
                      void finishRename();
                    }}
                    disabled={isRenaming || isInteractionDisabled || isConfirmingDelete}
                    className="h-9"
                    aria-label={`Rename ${project.name}`}
                  />
                  <p className="text-xs text-muted-foreground">Enter saves. Escape cancels.</p>
                </div>
              ) : (
                <p className="truncate text-base font-medium tracking-tight text-foreground">
                  {project.name}
                </p>
              )}
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-3.5" />
                <span>{formatProjectUpdatedAt(project.updatedAt)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      void finishRename();
                    }}
                    disabled={isRenaming || isInteractionDisabled || isConfirmingDelete}
                    aria-label={`Save ${project.name} name`}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={cancelRename}
                    disabled={isRenaming || isInteractionDisabled || isConfirmingDelete}
                    aria-label={`Cancel renaming ${project.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isInteractionDisabled || isConfirmingDelete) return;
                      setDraftName(project.name);
                      setIsEditingName(true);
                    }}
                    disabled={isInteractionDisabled || isConfirmingDelete}
                    aria-label={`Rename ${project.name}`}
                  >
                    <PencilLine className="size-4" />
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startDeleteConfirmation}
                    disabled={isInteractionDisabled}
                    aria-label={`Delete ${project.name}`}
                    className="text-foreground/64 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          {isConfirmingDelete ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-foreground">Delete this project?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This removes it permanently. There is no undo.
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelDeleteConfirmation}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    void confirmDelete();
                  }}
                  disabled={isDeletingProject}
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? "Deleting..." : "Delete project"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-end">
          <Button
            asChild
            size="sm"
            className="bg-blue-500 text-white hover:bg-blue-500/90"
            disabled={isEditingName || isRenaming || isInteractionDisabled || isConfirmingDelete}
          >
            <Link href={`/editor/${project.id}`}>
              Open project
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
