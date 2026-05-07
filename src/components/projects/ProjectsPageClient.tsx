"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Blocks,
  BorderAll,
  InfoCircle,
  Plus,
  RefreshCcw,
  Stack,
} from "@/components/ui/icons";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import {
  createOrFetchAnonymousUser,
  createUnsavedProject,
  finalizeUnsavedProject,
  deleteProject,
  fetchProjects,
  updateProject,
} from "@/lib/projects/clientApi";
import { ensureFirstProject } from "@/lib/projects/bootstrap";
import {
  clearActiveProjectIdIfMatches,
  getOrCreateAnonymousClientToken,
  saveActiveProjectId,
} from "@/lib/projects/clientIdentity";
import { createEmptyProjectDocument, getDefaultProjectName } from "@/lib/projects/defaults";
import { completeEditorOnboardingHint } from "@/lib/editor/onboardingHints";
import type { ProjectListItem } from "@/lib/projects/types";
import {
  mergeProjectIntoList,
  removeProjectFromList,
  sortProjectsByUpdatedAt,
} from "@/lib/projects/listState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectDeleteDialog } from "@/components/projects/ProjectDeleteDialog";
import { TierLimitUpsellDialog } from "@/components/editor/TierLimitUpsellDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getEffectiveMaxProjects } from "@/lib/subscription/features";
import type { SubscriptionTier } from "@/lib/subscription/tiers";

const DEV_SUBSCRIPTION_TIER_STORAGE_KEY = "spaceforge_dev_subscription_tier";
const DEV_MODE_ENABLED = process.env.NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE === "true";

type ProjectFilterState = {
  minRooms: number | null;
  minArea: number | null;
  minFloors: number | null;
};

type ProjectFilterKey = keyof ProjectFilterState;

type ProjectFilterOption = {
  key: ProjectFilterKey;
  value: number;
  label: string;
  icon: typeof Blocks;
  paidOnly?: boolean;
};

const DEFAULT_PROJECT_FILTERS: ProjectFilterState = {
  minRooms: null,
  minArea: null,
  minFloors: null,
};

const PROJECT_FILTER_OPTIONS: ProjectFilterOption[] = [
  {
    key: "minRooms",
    value: 3,
    label: "3+ rooms",
    icon: Blocks,
  },
  {
    key: "minArea",
    value: 50,
    label: "50m²+",
    icon: BorderAll,
  },
  {
    key: "minFloors",
    value: 2,
    label: "2+ floors",
    icon: Stack,
    paidOnly: true,
  },
];

function getProjectTotalAreaSquareMetres(project: ProjectListItem) {
  return (project.stats?.totalAreaSquareMillimetres ?? 0) / 1_000_000;
}

function projectMatchesFilters(project: ProjectListItem, filters: ProjectFilterState) {
  if (filters.minRooms !== null && (project.stats?.roomCount ?? 0) < filters.minRooms) {
    return false;
  }

  if (
    filters.minArea !== null &&
    getProjectTotalAreaSquareMetres(project) < filters.minArea
  ) {
    return false;
  }

  if (filters.minFloors !== null && (project.stats?.floorCount ?? 1) < filters.minFloors) {
    return false;
  }

  return true;
}

function loadDevSubscriptionTierFromStorage(): SubscriptionTier {
  if (!DEV_MODE_ENABLED || typeof window === "undefined") {
    return "Free";
  }

  try {
    const stored = window.localStorage.getItem(DEV_SUBSCRIPTION_TIER_STORAGE_KEY);
    if (stored && ["Free", "Pro", "Studio", "Education"].includes(stored)) {
      return stored as SubscriptionTier;
    }
  } catch {
    // localStorage may be unavailable in some environments
  }

  return "Free";
}

export function ProjectsPageClient() {
  const router = useRouter();
  const interactionSectionRef = useRef<HTMLElement | null>(null);
  const deletionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingProject, startCreateProjectTransition] = useTransition();
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<ProjectListItem | null>(null);
  const [isProjectLimitDialogOpen, setIsProjectLimitDialogOpen] = useState(false);
  // First of the /projects trio: info overlay, then filtering, then layout modes.
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  // Second of the /projects trio: local filter controls first, filtering logic next.
  const [projectFilters, setProjectFilters] = useState<ProjectFilterState>(
    DEFAULT_PROJECT_FILTERS
  );
  const [devTier, setDevTier] = useState<SubscriptionTier>("Free");
  const didLoadProjectsRef = useRef(false);
  const [hasMeaningfulProjectsInteraction, setHasMeaningfulProjectsInteraction] = useState(false);

  // Load dev tier from localStorage on mount
  useEffect(() => {
    setDevTier(loadDevSubscriptionTierFromStorage());

    // Listen for storage changes (e.g., dev tier changed in editor)
    const handleStorageChange = () => {
      setDevTier(loadDevSubscriptionTierFromStorage());
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
  
  // Current subscription tier (respects dev mode when enabled)
  const currentTier: SubscriptionTier = DEV_MODE_ENABLED ? devTier : "Free";
  const canUsePaidProjectFilters = currentTier !== "Free";

  const loadProjects = async ({ showLoadingState }: { showLoadingState: boolean }) => {
    if (showLoadingState) {
      setIsLoading(true);
    }

    try {
      const clientToken = getOrCreateAnonymousClientToken();
      await createOrFetchAnonymousUser(clientToken);
      const loadedProjects = await fetchProjects(clientToken);

      setProjects(sortProjectsByUpdatedAt(loadedProjects));
      setErrorMessage(null);
      didLoadProjectsRef.current = true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load projects.");
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (isCancelled) return;
      await loadProjects({ showLoadingState: true });
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const interactionSectionElement = interactionSectionRef.current;
    if (!interactionSectionElement || isLoading || errorMessage) {
      return;
    }

    const markInteraction = () => {
      setHasMeaningfulProjectsInteraction(true);
    };

    interactionSectionElement.addEventListener("pointerdown", markInteraction, { once: true });
    interactionSectionElement.addEventListener("keydown", markInteraction, { once: true });

    return () => {
      interactionSectionElement.removeEventListener("pointerdown", markInteraction);
      interactionSectionElement.removeEventListener("keydown", markInteraction);
    };
  }, [errorMessage, isLoading]);

  useEffect(() => {
    if (canUsePaidProjectFilters || projectFilters.minFloors === null) {
      return;
    }

    setProjectFilters((currentFilters) => ({
      ...currentFilters,
      minFloors: null,
    }));
  }, [canUsePaidProjectFilters, projectFilters.minFloors]);

  useEffect(() => {
    if (
      projects.length > 1 ||
      Object.values(projectFilters).every((value) => value === null)
    ) {
      return;
    }

    setProjectFilters(DEFAULT_PROJECT_FILTERS);
  }, [projectFilters, projects.length]);

  const canCreateProject =
    !isCreatingProject &&
    renamingProjectId === null &&
    deletingProjectId === null;

  const maxProjects = getEffectiveMaxProjects(currentTier);
  const isAtProjectLimit = projects.length >= maxProjects;
  const shouldShowProjectLimitBanner = currentTier === "Free" && isAtProjectLimit;
  const availableProjectFilterOptions = PROJECT_FILTER_OPTIONS.filter(
    (filterOption) => !filterOption.paidOnly || canUsePaidProjectFilters
  );
  const effectiveProjectFilters: ProjectFilterState = canUsePaidProjectFilters
    ? projectFilters
    : {
        ...projectFilters,
        minFloors: null,
      };
  const activeFilterCount = Object.values(effectiveProjectFilters).filter(
    (value) => value !== null
  ).length;
  const filteredProjects = projects.filter((project) =>
    projectMatchesFilters(project, effectiveProjectFilters)
  );
  const shouldShowProjectFilters = projects.length > 1;

  const toggleProjectFilter = (key: ProjectFilterKey, value: number) => {
    setProjectFilters((currentFilters) => ({
      ...currentFilters,
      [key]: currentFilters[key] === value ? null : value,
    }));
  };

  const clearProjectFilters = () => {
    setProjectFilters(DEFAULT_PROJECT_FILTERS);
  };

  const handleCreateProject = () => {
    if (!canCreateProject) return;

    // Check project limit
    if (isAtProjectLimit) {
      setIsProjectLimitDialogOpen(true);
      return;
    }

    startCreateProjectTransition(() => {
      void (async () => {
        try {
          setErrorMessage(null);
          const clientToken = getOrCreateAnonymousClientToken();
          await createOrFetchAnonymousUser(clientToken);

          const project =
            projects.length === 0
              ? await ensureFirstProject(clientToken, createEmptyProjectDocument())
              : await createUnsavedProject(clientToken, {
                  name: getDefaultProjectName({ existingProjectCount: projects.length }),
                  document: createEmptyProjectDocument(),
                });

          saveActiveProjectId(project.id);
          router.push(`/editor/${project.id}`);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to create project.");
        }
      })();
    });
  };

  const handleRenameProject = async (projectId: string, name: string) => {
    if (isCreatingProject || renamingProjectId !== null || deletingProjectId !== null) return;

    setRenamingProjectId(projectId);

    try {
      setErrorMessage(null);
      const clientToken = getOrCreateAnonymousClientToken();
      const project = await updateProject(clientToken, projectId, { name });
      completeEditorOnboardingHint("project-name");
      setProjects((currentProjects) => mergeProjectIntoList(currentProjects, project));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to rename project.");
      throw error;
    } finally {
      setRenamingProjectId(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (isCreatingProject || renamingProjectId !== null || deletingProjectId !== null) return;

    setDeletingProjectId(projectId);

    try {
      setErrorMessage(null);
      const clientToken = getOrCreateAnonymousClientToken();
      const deletedProject = await deleteProject(clientToken, projectId);

      clearActiveProjectIdIfMatches(deletedProject.id);
      setProjects((currentProjects) => removeProjectFromList(currentProjects, deletedProject.id));
      setProjectPendingDelete((currentProject) =>
        currentProject?.id === deletedProject.id ? null : currentProject
      );
      setErrorMessage(null);

      // Show undo toast for 5 seconds
      if (deletionTimeoutRef.current) {
        clearTimeout(deletionTimeoutRef.current);
      }

      toast.error(`Deleted project "${deletedProject.name}"`, {
        action: {
          label: "Undo",
          onClick: async () => {
            // Restore project to UI immediately
            setProjects((currentProjects) =>
              mergeProjectIntoList(currentProjects, deletedProject)
            );

            // Restore project to API
            try {
              await finalizeUnsavedProject(clientToken, deletedProject.id, {
                name: deletedProject.name,
                document: deletedProject.document,
              });
            } catch (error) {
              console.error("Failed to restore deleted project.", error);
              setErrorMessage("Failed to restore project. Removing it again.");
              // Remove from UI if restoration failed
              setProjects((currentProjects) =>
                removeProjectFromList(currentProjects, deletedProject.id)
              );
            }

            // Clear the timeout since undo was performed
            if (deletionTimeoutRef.current) {
              clearTimeout(deletionTimeoutRef.current);
              deletionTimeoutRef.current = null;
            }
          },
        },
        duration: 5000,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete project.");
      throw error;
    } finally {
      setDeletingProjectId(null);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deletionTimeoutRef.current) {
        clearTimeout(deletionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <section
        ref={interactionSectionRef}
        className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-8 sm:py-12"
        tabIndex={-1}
      >
        <div className="flex flex-col gap-5 border-b border-border/70 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="font-measurement text-xs font-semibold tracking-[0.18em] text-foreground/45 uppercase">
              Projects
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Recent layouts, kept simple
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Open an existing plan or start a fresh project. No dashboard sprawl, just your latest work.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ImmediateTooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-lg"
                    aria-label="Show project details"
                    aria-pressed={showProjectInfo}
                    onClick={() => setShowProjectInfo((current) => !current)}
                    className="rounded-full text-foreground/70 hover:text-foreground"
                  >
                    <InfoCircle className="size-4.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                  Show project details
                </TooltipContent>
              </Tooltip>
            </ImmediateTooltipProvider>

            <Button
              type="button"
              size="lg"
              onClick={handleCreateProject}
              disabled={isCreatingProject}
              className="h-11 rounded-full bg-blue-500 px-5 text-white hover:bg-blue-500/90"
            >
              <Plus className="size-4" />
              New project
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-foreground/55" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {didLoadProjectsRef.current ? "Projects update failed" : "Projects unavailable"}
                </p>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadProjects({ showLoadingState: !didLoadProjectsRef.current });
              }}
              disabled={
                isLoading ||
                isCreatingProject ||
                renamingProjectId !== null ||
                deletingProjectId !== null
              }
            >
              <RefreshCcw className="size-4" />
              Retry
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-xl border border-border/60 bg-muted/35"
              />
            ))}
          </div>
        ) : null}

        {!isLoading && projects.length === 0 ? (
          <Empty className="min-h-60">
            <EmptyHeader>
              <EmptyTitle>{errorMessage ? "Projects unavailable" : "No projects yet"}</EmptyTitle>
              <EmptyDescription className="max-w-md">
                {errorMessage
                  ? "Retry loading or create a fresh project to continue with a clean document."
                  : "Create your first project to start sketching a new layout with a clean document."}
              </EmptyDescription>
            </EmptyHeader>
            <div className="mt-6 flex items-center gap-3">
              <Button
                type="button"
                onClick={handleCreateProject}
                disabled={!canCreateProject}
                className="bg-blue-500 text-white hover:bg-blue-500/90"
              >
                <Plus className="size-4" />
                New project
              </Button>
              {errorMessage ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void loadProjects({ showLoadingState: true });
                  }}
                  disabled={
                    isLoading ||
                    isCreatingProject ||
                    renamingProjectId !== null ||
                    deletingProjectId !== null
                  }
                >
                  <RefreshCcw className="size-4" />
                  Retry
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href="/editor">
                  Open editor
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Empty>
        ) : null}

        {!isLoading && projects.length > 0 ? (
          <div className="space-y-4">
            {shouldShowProjectFilters ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/45 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Filter projects</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Showing {filteredProjects.length} of {projects.length}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {availableProjectFilterOptions.map((filterOption) => {
                    const Icon = filterOption.icon;
                    const isActive =
                      projectFilters[filterOption.key] === filterOption.value;

                    return (
                      <Button
                        key={`${filterOption.key}-${filterOption.value}`}
                        type="button"
                        variant={isActive ? "secondary" : "outline"}
                        size="sm"
                        aria-pressed={isActive}
                        onClick={() =>
                          toggleProjectFilter(filterOption.key, filterOption.value)
                        }
                        className="rounded-full"
                      >
                        <Icon className="size-3.5" />
                        {filterOption.label}
                      </Button>
                    );
                  })}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearProjectFilters}
                    disabled={activeFilterCount === 0}
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    Clear all
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onRename={handleRenameProject}
                  onDeleteRequest={setProjectPendingDelete}
                  isRenaming={renamingProjectId === project.id}
                  isDeleting={deletingProjectId === project.id}
                  showProjectInfo={showProjectInfo}
                  currentTier={currentTier}
                  isInteractionDisabled={
                    isCreatingProject ||
                    (deletingProjectId !== null && deletingProjectId !== project.id)
                  }
                />
              ))}
              {shouldShowProjectLimitBanner ? (
                <Card
                  onClick={() => setIsProjectLimitDialogOpen(true)}
                  className="border-border/70 bg-gradient-to-br from-blue-50/50 to-blue-50/30 transition-colors hover:border-blue-200/70 hover:bg-blue-50/60 cursor-pointer dark:from-blue-950/20 dark:to-blue-950/10 dark:hover:border-blue-900/50 dark:hover:bg-blue-950/30"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setIsProjectLimitDialogOpen(true);
                    }
                  }}
                >
                  <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="space-y-2">
                      <p className="text-base font-semibold tracking-tight text-foreground">
                        Unlock unlimited projects
                      </p>
                      <p className="text-sm leading-5 text-muted-foreground">
                        Upgrade to Pro to create as many projects as you need.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsProjectLimitDialogOpen(true);
                      }}
                      className="mt-1"
                    >
                      Learn more
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}

        <ProjectDeleteDialog
          project={projectPendingDelete}
          open={projectPendingDelete !== null}
          isDeleting={deletingProjectId === projectPendingDelete?.id}
          onOpenChange={(open) => {
            if (!open && deletingProjectId === null) {
              setProjectPendingDelete(null);
            }
          }}
          onConfirmDelete={() => {
            if (!projectPendingDelete) return;
            void handleDeleteProject(projectPendingDelete.id);
          }}
        />

        <TierLimitUpsellDialog
          open={isProjectLimitDialogOpen}
          onOpenChange={setIsProjectLimitDialogOpen}
          featureKey="projects"
          currentTier={currentTier}
        />
      </section>
      <FeedbackWidget
        pageContext="projects"
        promptEligible={hasMeaningfulProjectsInteraction && didLoadProjectsRef.current && !errorMessage}
        surface="light"
        getMetadata={() => ({
          projectCount: projects.length,
          trigger: "projects-page-interaction",
        })}
      />
    </main>
  );
}
