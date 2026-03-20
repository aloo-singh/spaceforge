"use client";

import Link from "next/link";
import { useState } from "react";
import EditorCanvas from "@/components/editor/EditorCanvas";
import { EditorProjectBootstrap } from "@/components/editor/EditorProjectBootstrap";
import { EditorProjectChrome } from "@/components/editor/EditorProjectChrome";
import { Button } from "@/components/ui/button";

type EditorPageShellProps = {
  projectId?: string;
};

export function EditorPageShell({ projectId }: EditorPageShellProps) {
  const [activeProject, setActiveProject] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [projectRenameSessionCount, setProjectRenameSessionCount] = useState(0);
  const [bootstrapState, setBootstrapState] = useState<
    | { status: "loading" }
    | { status: "ready" }
    | { status: "error"; message: string }
  >({ status: "loading" });

  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-neutral-950 text-white">
      <EditorProjectBootstrap
        projectId={projectId}
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
      <EditorCanvas
        hasResolvedProject={activeProject !== null}
        projectRenameSessionCount={projectRenameSessionCount}
        topBarLeadingContent={
          <EditorProjectChrome
            projectId={activeProject?.id ?? null}
            projectName={activeProject?.name ?? null}
            isLoading={bootstrapState.status === "loading"}
            onProjectRenameStart={() => {
              setProjectRenameSessionCount((currentCount) => currentCount + 1);
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
    </main>
  );
}
