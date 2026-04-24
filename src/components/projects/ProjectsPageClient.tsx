"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Plus, RefreshCcw, LoaderCircle } from "@/components/ui/icons";
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
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

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
  const didLoadProjectsRef = useRef(false);
  const [hasMeaningfulProjectsInteraction, setHasMeaningfulProjectsInteraction] = useState(false);

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

  const canCreateProject =
    !isCreatingProject &&
    renamingProjectId === null &&
    deletingProjectId === null;

  const handleCreateProject = () => {
    if (!canCreateProject) return;

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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRename={handleRenameProject}
                onDeleteRequest={setProjectPendingDelete}
                isRenaming={renamingProjectId === project.id}
                isDeleting={deletingProjectId === project.id}
                isInteractionDisabled={
                  isCreatingProject ||
                  (deletingProjectId !== null && deletingProjectId !== project.id)
                }
              />
            ))}
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
