"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpenDot, Plus } from "lucide-react";
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

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      try {
        const clientToken = getOrCreateAnonymousClientToken();
        await createOrFetchAnonymousUser(clientToken);
        const loadedProjects = await fetchProjects(clientToken);
        if (isCancelled) return;

        setProjects(sortProjectsByUpdatedAt(loadedProjects));
        setErrorMessage(null);
      } catch (error) {
        if (isCancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load projects.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleCreateProject = () => {
    startCreateProjectTransition(() => {
      void (async () => {
        try {
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
    setRenamingProjectId(projectId);

    try {
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
          <Empty className="min-h-52">
            <EmptyHeader>
              <EmptyTitle>Projects unavailable</EmptyTitle>
              <EmptyDescription className="max-w-xl">{errorMessage}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!errorMessage && isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-xl border border-border/60 bg-muted/35"
              />
            ))}
          </div>
        ) : null}

        {!errorMessage && !isLoading && projects.length === 0 ? (
          <Empty className="min-h-60">
            <EmptyHeader>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription className="max-w-md">
                Create your first project to start sketching a new layout with a clean document.
              </EmptyDescription>
            </EmptyHeader>
            <div className="mt-6 flex items-center gap-3">
              <Button
                type="button"
                onClick={handleCreateProject}
                disabled={isCreatingProject}
                className="bg-blue-500 text-white hover:bg-blue-500/90"
              >
                <Plus className="size-4" />
                {isCreatingProject ? "Creating project..." : "New project"}
              </Button>
              <Button asChild variant="outline">
                <Link href="/editor">
                  Open editor
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Empty>
        ) : null}

        {!errorMessage && !isLoading && projects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onRename={handleRenameProject}
                isRenaming={renamingProjectId === project.id}
              />
            ))}
          </div>
        ) : null}

        {!errorMessage && !isLoading && projects.length > 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpenDot className="size-4" />
            <span>Projects open in the editor without changing the document structure.</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}
