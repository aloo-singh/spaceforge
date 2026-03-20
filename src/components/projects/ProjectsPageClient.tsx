"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, FolderOpenDot, Plus, RefreshCcw } from "lucide-react";
import { createOrFetchAnonymousUser, createProject, fetchProjects, updateProject } from "@/lib/projects/clientApi";
import { getOrCreateAnonymousClientToken, saveActiveProjectId } from "@/lib/projects/clientIdentity";
import { createEmptyProjectDocument, DEFAULT_PROJECT_NAME } from "@/lib/projects/defaults";
import type { ProjectListItem } from "@/lib/projects/types";
import { mergeProjectIntoList, sortProjectsByUpdatedAt } from "@/lib/projects/listState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function ProjectsPageClient() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingProject, startCreateProjectTransition] = useTransition();
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const didLoadProjectsRef = useRef(false);

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

  const handleCreateProject = () => {
    if (isCreatingProject || renamingProjectId !== null) return;

    startCreateProjectTransition(() => {
      void (async () => {
        try {
          setErrorMessage(null);
          const clientToken = getOrCreateAnonymousClientToken();
          await createOrFetchAnonymousUser(clientToken);

          const project = await createProject(clientToken, {
            name: DEFAULT_PROJECT_NAME,
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
    if (isCreatingProject || renamingProjectId !== null) return;

    setRenamingProjectId(projectId);

    try {
      setErrorMessage(null);
      const clientToken = getOrCreateAnonymousClientToken();
      const project = await updateProject(clientToken, projectId, { name });
      setProjects((currentProjects) => mergeProjectIntoList(currentProjects, project));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to rename project.");
      throw error;
    } finally {
      setRenamingProjectId(null);
    }
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-8 sm:py-12">
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
            {isCreatingProject ? "Creating project..." : "New project"}
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
              disabled={isLoading || isCreatingProject || renamingProjectId !== null}
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
                disabled={isCreatingProject || renamingProjectId !== null}
                className="bg-blue-500 text-white hover:bg-blue-500/90"
              >
                <Plus className="size-4" />
                {isCreatingProject ? "Creating project..." : "New project"}
              </Button>
              {errorMessage ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void loadProjects({ showLoadingState: true });
                  }}
                  disabled={isLoading || isCreatingProject || renamingProjectId !== null}
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
                isRenaming={renamingProjectId === project.id}
                isInteractionDisabled={isCreatingProject}
              />
            ))}
          </div>
        ) : null}

        {!isLoading && projects.length > 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpenDot className="size-4" />
            <span>Projects open in the editor without changing the document structure.</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}
