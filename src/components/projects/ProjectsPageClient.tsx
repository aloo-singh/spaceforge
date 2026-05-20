"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Blocks,
  BorderAll,
  Columns2,
  Columns3,
  Filter2,
  InfoCircle,
  LayoutList,
  Plus,
  RefreshCcw,
  Stack,
} from "@/components/ui/icons";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import {
  createOrFetchAnonymousUser,
  createUnsavedProject,
  deleteProject,
  duplicateProject,
  fetchProjects,
  finalizeUnsavedProject,
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
import { Button, ButtonGroup } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Toggle } from "@/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ImmediateTooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { getEffectiveMaxProjects } from "@/lib/subscription/features";
import type { SubscriptionTier } from "@/lib/subscription/tiers";

const DEV_SUBSCRIPTION_TIER_STORAGE_KEY = "spaceforge_dev_subscription_tier";
const PROJECT_LAYOUT_STORAGE_KEY = "spaceforge_project_layout";
const DEV_MODE_ENABLED = process.env.NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE === "true";

type ProjectLayout = "grid-small" | "grid-large" | "list";

type ProjectFilterState = {
  minRooms: number | null;
  minArea: number | null;
  minFloors: number | null;
};

type ProjectFilterKey = keyof ProjectFilterState;

type ProjectFilterOption = {
  key: ProjectFilterKey;
  label: string;
  placeholder: string;
  icon: typeof Blocks;
  paidOnly?: boolean;
  options: {
    value: number;
    label: string;
  }[];
};

type ProjectLayoutOption = {
  value: ProjectLayout;
  label: string;
  icon: typeof Columns3;
  shortcut: string;
};

const PROJECT_FILTER_ANY_VALUE = "any";

const DEFAULT_PROJECT_LAYOUT: ProjectLayout = "grid-small";

const DEFAULT_PROJECT_FILTERS: ProjectFilterState = {
  minRooms: null,
  minArea: null,
  minFloors: null,
};

const PROJECT_FILTER_OPTIONS: ProjectFilterOption[] = [
  {
    key: "minRooms",
    label: "Min rooms",
    placeholder: "Any rooms",
    icon: Blocks,
    options: [
      { value: 1, label: "1+ room" },
      { value: 3, label: "3+ rooms" },
      { value: 5, label: "5+ rooms" },
      { value: 10, label: "10+ rooms" },
    ],
  },
  {
    key: "minArea",
    label: "Min area",
    placeholder: "Any area",
    icon: BorderAll,
    options: [
      { value: 10, label: "10+ m²" },
      { value: 25, label: "25+ m²" },
      { value: 50, label: "50+ m²" },
      { value: 100, label: "100+ m²" },
    ],
  },
  {
    key: "minFloors",
    label: "Min floors",
    placeholder: "Any floors",
    icon: Stack,
    paidOnly: true,
    options: [
      { value: 1, label: "1+ floor" },
      { value: 2, label: "2+ floors" },
      { value: 3, label: "3+ floors" },
    ],
  },
];

const PROJECT_LAYOUT_OPTIONS: ProjectLayoutOption[] = [
  {
    value: "grid-small",
    label: "Grid small",
    icon: Columns3,
    shortcut: "1",
  },
  {
    value: "grid-large",
    label: "Grid large",
    icon: Columns2,
    shortcut: "2",
  },
  {
    value: "list",
    label: "List",
    icon: LayoutList,
    shortcut: "3",
  },
];

function ShortcutTooltipContent({
  label,
  shortcut,
}: {
  label: string;
  shortcut: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <KbdGroup>
        <Kbd>{shortcut}</Kbd>
      </KbdGroup>
    </span>
  );
}

function isKeyboardShortcutEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"], [data-radix-select-trigger], [data-radix-select-content]'
    )
  );
}

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

function formatProjectFilterSelectValue(value: number | null) {
  return value === null ? PROJECT_FILTER_ANY_VALUE : String(value);
}

function isProjectLayout(value: string | null): value is ProjectLayout {
  return value === "grid-small" || value === "grid-large" || value === "list";
}

function loadProjectLayoutFromStorage(): ProjectLayout {
  if (typeof window === "undefined") {
    return DEFAULT_PROJECT_LAYOUT;
  }

  try {
    const stored = window.localStorage.getItem(PROJECT_LAYOUT_STORAGE_KEY);
    return isProjectLayout(stored) ? stored : DEFAULT_PROJECT_LAYOUT;
  } catch {
    return DEFAULT_PROJECT_LAYOUT;
  }
}

function getProjectLayoutClassName(projectLayout: ProjectLayout) {
  if (projectLayout === "grid-large") {
    return "grid gap-5 transition-[gap] duration-150 ease-out lg:grid-cols-2 motion-reduce:transition-none";
  }

  if (projectLayout === "list") {
    return "flex flex-col gap-3 transition-[gap] duration-150 ease-out motion-reduce:transition-none";
  }

  return "grid gap-4 transition-[gap] duration-150 ease-out sm:grid-cols-2 xl:grid-cols-3 motion-reduce:transition-none";
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
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<ProjectListItem | null>(null);
  const [isProjectLimitDialogOpen, setIsProjectLimitDialogOpen] = useState(false);
  // First of the /projects trio: info overlay, then filtering, then layout modes.
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  // Second of the /projects trio: local filter controls first, filtering logic next.
  const [projectFilters, setProjectFilters] = useState<ProjectFilterState>(
    DEFAULT_PROJECT_FILTERS
  );
  const [showProjectFilters, setShowProjectFilters] = useState(false);
  // Third of the /projects trio: layout preference state first, rendering modes next.
  const [projectLayout, setProjectLayout] = useState<ProjectLayout>(DEFAULT_PROJECT_LAYOUT);
  const [hasLoadedProjectLayout, setHasLoadedProjectLayout] = useState(false);
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

  useEffect(() => {
    if (!hasLoadedProjectLayout) {
      return;
    }

    try {
      window.localStorage.setItem(PROJECT_LAYOUT_STORAGE_KEY, projectLayout);
    } catch {
      // localStorage may be unavailable in some environments
    }
  }, [hasLoadedProjectLayout, projectLayout]);

  useEffect(() => {
    setProjectLayout(loadProjectLayoutFromStorage());
    setHasLoadedProjectLayout(true);
  }, []);

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
    duplicatingProjectId === null &&
    deletingProjectId === null;

  const maxProjects = getEffectiveMaxProjects(currentTier);
  const isAtProjectLimit = projects.length >= maxProjects;
  const isAtDuplicateProjectLimit = currentTier === "Free" && isAtProjectLimit;
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

  const setProjectFilterFromSelect = (key: ProjectFilterKey, selectedValue: string) => {
    setProjectFilters((currentFilters) => ({
      ...currentFilters,
      [key]:
        selectedValue === PROJECT_FILTER_ANY_VALUE
          ? null
          : Number.parseInt(selectedValue, 10),
    }));
  };

  const clearProjectFilters = () => {
    setProjectFilters(DEFAULT_PROJECT_FILTERS);
  };

  const handleCreateProject = useCallback(() => {
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
  }, [canCreateProject, isAtProjectLimit, projects.length, router, startCreateProjectTransition]);

  useEffect(() => {
    const handleProjectsPageShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isKeyboardShortcutEditableTarget(event.target)
      ) {
        return;
      }

      const shortcutKey = event.key.toLowerCase();

      if (shortcutKey === "f" && shouldShowProjectFilters) {
        event.preventDefault();
        setShowProjectFilters((current) => !current);
        return;
      }

      if (shortcutKey === "i") {
        event.preventDefault();
        setShowProjectInfo((current) => !current);
        return;
      }

      if (shortcutKey === "n") {
        event.preventDefault();
        handleCreateProject();
        return;
      }

      if (shortcutKey === "1") {
        event.preventDefault();
        setProjectLayout("grid-small");
        return;
      }

      if (shortcutKey === "2") {
        event.preventDefault();
        setProjectLayout("grid-large");
        return;
      }

      if (shortcutKey === "3") {
        event.preventDefault();
        setProjectLayout("list");
      }
    };

    window.addEventListener("keydown", handleProjectsPageShortcut);
    return () => window.removeEventListener("keydown", handleProjectsPageShortcut);
  }, [handleCreateProject, shouldShowProjectFilters]);

  const handleRenameProject = async (projectId: string, name: string) => {
    if (
      isCreatingProject ||
      renamingProjectId !== null ||
      duplicatingProjectId !== null ||
      deletingProjectId !== null
    ) {
      return;
    }

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

  const handleDuplicateProject = async (projectId: string) => {
    if (
      isCreatingProject ||
      renamingProjectId !== null ||
      duplicatingProjectId !== null ||
      deletingProjectId !== null
    ) {
      return;
    }

    if (isAtDuplicateProjectLimit) {
      setIsProjectLimitDialogOpen(true);
      return;
    }

    setDuplicatingProjectId(projectId);

    try {
      setErrorMessage(null);
      const clientToken = getOrCreateAnonymousClientToken();
      const duplicatedProject = await duplicateProject(clientToken, projectId);
      setProjects((currentProjects) => mergeProjectIntoList(currentProjects, duplicatedProject));
      await loadProjects({ showLoadingState: false });
      toast.success("Project duplicated", {
        description: duplicatedProject.name,
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to duplicate project.");
    } finally {
      setDuplicatingProjectId(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (
      isCreatingProject ||
      renamingProjectId !== null ||
      duplicatingProjectId !== null ||
      deletingProjectId !== null
    ) {
      return;
    }

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
            {shouldShowProjectFilters ? (
              <ImmediateTooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      variant="toolbar"
                      size="icon-lg"
                      pressed={showProjectFilters}
                      onPressedChange={setShowProjectFilters}
                      data-active={showProjectFilters}
                      aria-label={showProjectFilters ? "Hide project filters" : "Show project filters"}
                      aria-controls="project-filters-panel"
                      aria-expanded={showProjectFilters}
                      className="rounded-full"
                    >
                      <Filter2 className="size-4.5" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="center">
                    <ShortcutTooltipContent
                      label={showProjectFilters ? "Hide project filters" : "Show project filters"}
                      shortcut="F"
                    />
                  </TooltipContent>
                </Tooltip>
              </ImmediateTooltipProvider>
            ) : null}

            <ImmediateTooltipProvider>
              <ButtonGroup className="h-11 rounded-full">
                {PROJECT_LAYOUT_OPTIONS.map((layoutOption) => {
                  const Icon = layoutOption.icon;
                  const isActive = projectLayout === layoutOption.value;

                  return (
                    <Tooltip key={layoutOption.value}>
                      <TooltipTrigger asChild>
                        <span data-slot="button-group-item" className="inline-flex">
                          <Toggle
                            variant="toolbar"
                            size="icon-lg"
                            pressed={isActive}
                            onPressedChange={() => setProjectLayout(layoutOption.value)}
                            data-active={isActive}
                            aria-label={layoutOption.label}
                            className="h-11 w-11"
                          >
                            <Icon className="size-4" />
                          </Toggle>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="center">
                        <ShortcutTooltipContent
                          label={layoutOption.label}
                          shortcut={layoutOption.shortcut}
                        />
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </ButtonGroup>
            </ImmediateTooltipProvider>

            <ImmediateTooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    variant="toolbar"
                    size="icon-lg"
                    pressed={showProjectInfo}
                    onPressedChange={setShowProjectInfo}
                    data-active={showProjectInfo}
                    aria-label={showProjectInfo ? "Hide project details" : "Show project details"}
                    className="rounded-full"
                  >
                    <InfoCircle className="size-4.5" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                  <ShortcutTooltipContent
                    label={showProjectInfo ? "Hide project details" : "Show project details"}
                    shortcut="I"
                  />
                </TooltipContent>
              </Tooltip>
            </ImmediateTooltipProvider>

            <ImmediateTooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center">
                  <ShortcutTooltipContent label="New project" shortcut="N" />
                </TooltipContent>
              </Tooltip>
            </ImmediateTooltipProvider>
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
                duplicatingProjectId !== null ||
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
                    duplicatingProjectId !== null ||
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
              <div
                className={
                  showProjectFilters
                    ? "grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity,transform] duration-200 ease-out motion-reduce:transition-none"
                    : "grid grid-rows-[0fr] -translate-y-1 opacity-0 transition-[grid-template-rows,opacity,transform] duration-200 ease-out motion-reduce:transition-none"
                }
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    id="project-filters-panel"
                    aria-hidden={!showProjectFilters}
                    inert={showProjectFilters ? undefined : true}
                    className="space-y-3 rounded-xl border border-border/70 bg-card/45 p-3 sm:p-4"
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {availableProjectFilterOptions.map((filterOption) => {
                          const Icon = filterOption.icon;

                          return (
                            <Select
                              key={filterOption.key}
                              value={formatProjectFilterSelectValue(
                                projectFilters[filterOption.key]
                              )}
                              onValueChange={(selectedValue) =>
                                setProjectFilterFromSelect(filterOption.key, selectedValue)
                              }
                            >
                              <SelectTrigger
                                id={`project-filter-${filterOption.key}`}
                                className="h-8 rounded-full bg-background/90 px-2.5 text-xs"
                              >
                                <SelectValue placeholder={filterOption.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  value={`${filterOption.key}-label`}
                                  disabled
                                  className="text-xs font-medium text-muted-foreground"
                                >
                                  <span className="inline-flex items-center gap-1.5">
                                    <Icon className="size-3.5 text-blue-500" />
                                    {filterOption.label}
                                  </span>
                                </SelectItem>
                                <SelectItem value={PROJECT_FILTER_ANY_VALUE}>
                                  {filterOption.placeholder}
                                </SelectItem>
                                {filterOption.options.map((option) => (
                                  <SelectItem
                                    key={`${filterOption.key}-${option.value}`}
                                    value={String(option.value)}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="text-xs leading-5 whitespace-nowrap text-muted-foreground">
                          Showing {filteredProjects.length} of {projects.length}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearProjectFilters}
                          disabled={activeFilterCount === 0}
                          className="h-8 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Clear all
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={getProjectLayoutClassName(projectLayout)}>
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onRename={handleRenameProject}
                  onDuplicate={handleDuplicateProject}
                  onDeleteRequest={setProjectPendingDelete}
                  isRenaming={renamingProjectId === project.id}
                  isDuplicating={duplicatingProjectId === project.id}
                  isDeleting={deletingProjectId === project.id}
                  showProjectInfo={showProjectInfo}
                  currentTier={currentTier}
                  layout={projectLayout}
                  isInteractionDisabled={
                    isCreatingProject ||
                    (duplicatingProjectId !== null && duplicatingProjectId !== project.id) ||
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
