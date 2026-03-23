"use client";

import Link from "next/link";
import { useState } from "react";
import EditorCanvas from "@/components/editor/EditorCanvas";
import { EditorProjectBootstrap } from "@/components/editor/EditorProjectBootstrap";
import { EditorProjectChrome } from "@/components/editor/EditorProjectChrome";
import { Button } from "@/components/ui/button";
import type { EditorOnboardingHintId } from "@/lib/editor/onboardingHints";

type EditorPageShellProps = {
  projectId?: string;
};

export function EditorPageShell({ projectId }: EditorPageShellProps) {
  const [activeProject, setActiveProject] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [activeHintId, setActiveHintId] = useState<EditorOnboardingHintId | null>(null);
  const [projectRenameCompletionCount, setProjectRenameCompletionCount] = useState(0);
  const [generateThumbnailDataUrl, setGenerateThumbnailDataUrl] = useState<(() => Promise<string | null>) | null>(null);
  const [bootstrapState, setBootstrapState] = useState<
    | { status: "loading" }
    | { status: "ready" }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const shouldHideCanvasDuringBootstrap = projectId !== undefined && bootstrapState.status === "loading";
  const handleThumbnailGeneratorChange = (nextGenerator: (() => Promise<string | null>) | null) => {
    setGenerateThumbnailDataUrl(() => nextGenerator);
  };

  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-neutral-950 text-white">
      <EditorProjectBootstrap
        projectId={projectId}
        generateThumbnailDataUrl={generateThumbnailDataUrl}
        onProjectResolved={(project) => {
          setActiveProject(project);
        }}
        onBootstrapStateChange={(state) => {
          setBootstrapState(state);
          if (state.status === "loading") {
            setActiveProject(null);
          }
        }}
      />
      {shouldHideCanvasDuringBootstrap ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/72 backdrop-blur">
            Loading project...
          </div>
        </div>
      ) : null}
      {bootstrapState.status === "error" ? (
        <div className="absolute top-4 left-4 z-10 max-w-sm rounded-2xl border border-white/12 bg-black/60 p-4 shadow-lg backdrop-blur">
          <p className="text-sm font-medium text-white">Project unavailable</p>
          <p className="mt-1 text-sm leading-6 text-white/72">{bootstrapState.message}</p>
          <div className="mt-4 flex items-center gap-3">
            <Button asChild size="sm" className="bg-blue-500 text-white hover:bg-blue-500/90">
              <Link href="/projects">Back to projects</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-white/18 bg-transparent text-white hover:bg-white/8">
              <Link href="/editor">Open active editor</Link>
            </Button>
          </div>
        </div>
      ) : null}
      {!shouldHideCanvasDuringBootstrap ? (
        <EditorCanvas
          hasResolvedProject={activeProject !== null}
          onDisplayedHintChange={setActiveHintId}
          onThumbnailGeneratorChange={handleThumbnailGeneratorChange}
          projectRenameCompletionCount={projectRenameCompletionCount}
          topBarLeadingContent={
            <EditorProjectChrome
              projectId={activeProject?.id ?? null}
              projectName={activeProject?.name ?? null}
              isLoading={bootstrapState.status === "loading"}
              isNameHighlighted={activeHintId === "project-name"}
              onProjectRenameCommitted={() => {
                setProjectRenameCompletionCount((currentCount) => currentCount + 1);
              }}
              onProjectNameChange={(name) => {
                setActiveProject((currentProject) =>
                  currentProject
                    ? {
                        ...currentProject,
                        name,
                      }
                    : currentProject
                );
              }}
            />
          }
        />
      ) : null}
    </main>
  );
}
