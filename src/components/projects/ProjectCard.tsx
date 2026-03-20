"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Clock3, PencilLine, X } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects/types";
import { formatProjectUpdatedAt } from "@/lib/projects/formatting";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProjectCardProps = {
  project: ProjectListItem;
  onRename: (projectId: string, name: string) => Promise<void>;
  isRenaming: boolean;
};

export function ProjectCard({ project, onRename, isRenaming }: ProjectCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingName) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditingName]);

  const finishRename = async () => {
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
      await onRename(project.id, nextName);
      setIsEditingName(false);
    } catch {
      inputRef.current?.focus();
    }
  };

  const cancelRename = () => {
    setDraftName(project.name);
    setIsEditingName(false);
  };

  return (
    <Card className="border-border/70 bg-card/75 transition-colors hover:border-border hover:bg-card">
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
                    disabled={isRenaming}
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
                    disabled={isRenaming}
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
                    disabled={isRenaming}
                    aria-label={`Cancel renaming ${project.name}`}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftName(project.name);
                    setIsEditingName(true);
                  }}
                  aria-label={`Rename ${project.name}`}
                >
                  <PencilLine className="size-4" />
                  Rename
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <Link
            href={`/editor/${project.id}`}
            className={`text-sm transition-colors focus-visible:text-foreground ${
              isEditingName || isRenaming
                ? "pointer-events-none text-foreground/35"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            Open project
          </Link>
          <Button
            asChild
            size="sm"
            className="bg-blue-500 text-white hover:bg-blue-500/90"
            disabled={isEditingName || isRenaming}
          >
            <Link href={`/editor/${project.id}`}>
              Open
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
