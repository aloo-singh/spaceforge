"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Blocks,
  BorderAll,
  CalendarWeek,
  Check,
  Clock3,
  PencilLine,
  Stack,
  Trash2,
  X,
} from "@/components/ui/icons";
import type { ProjectListItem } from "@/lib/projects/types";
import { formatProjectUpdatedAt } from "@/lib/projects/formatting";
import { formatMetricRoomArea } from "@/lib/editor/measurements";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SubscriptionTier } from "@/lib/subscription/tiers";

type ProjectCardProps = {
  project: ProjectListItem;
  onRename: (projectId: string, name: string) => Promise<void>;
  onDeleteRequest: (project: ProjectListItem) => void;
  isRenaming: boolean;
  isDeleting: boolean;
  showProjectInfo?: boolean;
  currentTier: SubscriptionTier;
  isInteractionDisabled?: boolean;
};

function formatProjectCreatedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getProjectCardStats(project: ProjectListItem) {
  return {
    roomCount: project.stats?.roomCount ?? 0,
    floorCount: project.stats?.floorCount ?? 1,
    totalArea: formatMetricRoomArea(project.stats?.totalAreaSquareMillimetres ?? 0),
    createdDate: formatProjectCreatedDate(project.createdAt),
  };
}

function ProjectInfoMetric({
  icon: Icon,
  isInteractive,
  label,
  tooltip,
  value,
}: {
  icon: typeof BorderAll;
  isInteractive: boolean;
  label: string;
  tooltip: string;
  value: string;
}) {
  return (
    <div className="min-h-[3.25rem] min-w-0 rounded-md border border-white/45 bg-white/60 px-2 py-1.5 shadow-sm backdrop-blur-md sm:px-2.5 sm:py-2 dark:border-white/10 dark:bg-slate-950/55">
      <div className="flex items-center gap-1.5 font-measurement text-[10px] font-semibold uppercase text-foreground/55">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`inline-flex ${isInteractive ? "pointer-events-auto" : "pointer-events-none"}`}
              onClick={(event) => event.stopPropagation()}
            >
              <Icon className="size-3.5 text-blue-500" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            {tooltip}
          </TooltipContent>
        </Tooltip>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 truncate font-measurement text-[13px] font-semibold text-foreground sm:mt-1 sm:text-sm">
        {value}
      </p>
    </div>
  );
}

export function ProjectCard({
  project,
  onRename,
  onDeleteRequest,
  isRenaming,
  isDeleting,
  showProjectInfo = false,
  currentTier,
  isInteractionDisabled = false,
}: ProjectCardProps) {
  const router = useRouter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const [hasThumbnailLoadError, setHasThumbnailLoadError] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRenameRef = useRef(false);
  const stats = getProjectCardStats(project);
  const canShowPaidStats = currentTier !== "Free";

  const handleCardClick = () => {
    if (isInteractionDisabled || isEditingName || isRenaming || isDeleting) return;
    router.push(`/editor/${project.id}`);
  };

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

  useEffect(() => {
    setHasThumbnailLoadError(false);
  }, [project.thumbnailDataUrl]);

  const finishRename = async () => {
    if (isSubmittingRenameRef.current || isInteractionDisabled) return;

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

  return (
    <Card 
      onClick={handleCardClick}
      className="border-border/70 bg-card/75 transition-colors hover:border-border hover:bg-card/95 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !isInteractionDisabled && !isEditingName && !isRenaming && !isDeleting) {
          handleCardClick();
        }
      }}
    >
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="relative overflow-hidden rounded-xl border border-border/70 bg-muted/35">
          <div
            className={`aspect-[8/5] w-full transform-gpu transition-[filter,transform] duration-200 ease-out motion-reduce:transition-none ${
              showProjectInfo ? "scale-[1.01] blur-[1.5px]" : "scale-100 blur-0"
            }`}
          >
            {project.thumbnailDataUrl && !hasThumbnailLoadError ? (
              <Image
                src={project.thumbnailDataUrl}
                alt={`Thumbnail preview for ${project.name}`}
                fill
                unoptimized
                sizes="(min-width: 1280px) 22rem, (min-width: 640px) 45vw, 100vw"
                className="object-cover"
                onError={() => {
                  setHasThumbnailLoadError(true);
                }}
              />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] bg-[size:24px_24px] bg-center dark:bg-[linear-gradient(to_right,rgba(248,250,252,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(248,250,252,0.08)_1px,transparent_1px)]">
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/30 to-transparent" />
                <div className="relative flex items-center gap-0.5 font-measurement text-lg font-semibold tracking-tight text-foreground/70">
                  <span className="text-blue-500">[s]</span>
                  <span>paceforge</span>
                </div>
              </div>
            )}
          </div>
          <div
            className={`pointer-events-none absolute inset-0 flex items-end bg-background/20 p-2.5 transition-opacity duration-200 ease-out motion-reduce:transition-none sm:p-3 dark:bg-background/25 ${
              showProjectInfo ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!showProjectInfo}
          >
            <ImmediateTooltipProvider>
              <div
                className={`grid w-full grid-cols-2 gap-1.5 transform-gpu transition-[opacity,transform] delay-75 duration-200 ease-out sm:gap-2 motion-reduce:transition-none ${
                  showProjectInfo ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
              >
                <ProjectInfoMetric
                  icon={Blocks}
                  isInteractive={showProjectInfo}
                  label="Rooms"
                  tooltip="Rooms you've sketched in this layout."
                  value={`${stats.roomCount}`}
                />
                <ProjectInfoMetric
                  icon={BorderAll}
                  isInteractive={showProjectInfo}
                  label="Area"
                  tooltip="All drawn room area, added together."
                  value={stats.totalArea}
                />
                {canShowPaidStats ? (
                  <>
                    <ProjectInfoMetric
                      icon={Stack}
                      isInteractive={showProjectInfo}
                      label="Floors"
                      tooltip="Floors in this layout, when your plan goes upstairs."
                      value={`${stats.floorCount}`}
                    />
                    <ProjectInfoMetric
                      icon={CalendarWeek}
                      isInteractive={showProjectInfo}
                      label="Created"
                      tooltip="The day this layout first joined your projects."
                      value={stats.createdDate}
                    />
                  </>
                ) : null}
              </div>
            </ImmediateTooltipProvider>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              {isEditingName ? (
                <div>
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
                    disabled={isRenaming || isInteractionDisabled}
                    className="h-9"
                    aria-label={`Rename ${project.name}`}
                  />
                </div>
              ) : (
                <p className="truncate text-base font-medium tracking-tight text-foreground">
                  {project.name}
                </p>
              )}
              {isEditingName ? (
                <p className="text-sm text-muted-foreground">Enter saves. Escape cancels.</p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  <span>{formatProjectUpdatedAt(project.updatedAt)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
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
                  disabled={isRenaming || isInteractionDisabled}
                  aria-label={`Save ${project.name} name`}
                  className="text-foreground/64 hover:bg-muted hover:text-foreground"
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={cancelRename}
                  disabled={isRenaming || isInteractionDisabled}
                  aria-label={`Cancel renaming ${project.name}`}
                  className="text-foreground/64 hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isInteractionDisabled) return;
                    setDraftName(project.name);
                    setIsEditingName(true);
                  }}
                  disabled={isInteractionDisabled}
                  aria-label={`Rename ${project.name}`}
                  title="Rename project"
                  className="text-foreground/64 hover:bg-muted hover:text-foreground"
                >
                  <PencilLine className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isInteractionDisabled) return;
                    setDraftName(project.name);
                    setIsEditingName(false);
                    onDeleteRequest(project);
                  }}
                  disabled={isInteractionDisabled}
                  aria-label={`Delete ${project.name}`}
                  title="Delete project"
                  className="text-foreground/64 hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            disabled={isEditingName || isRenaming || isInteractionDisabled}
            className="bg-blue-500 text-white hover:bg-blue-500/90"
          >
            Open project
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
