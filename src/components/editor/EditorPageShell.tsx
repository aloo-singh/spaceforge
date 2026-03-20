"use client";

import Link from "next/link";
import { useState } from "react";
import EditorCanvas from "@/components/editor/EditorCanvas";
import { EditorProjectBootstrap } from "@/components/editor/EditorProjectBootstrap";
import { Button } from "@/components/ui/button";

type EditorPageShellProps = {
  projectId?: string;
};

export function EditorPageShell({ projectId }: EditorPageShellProps) {
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
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
          setActiveProjectName(project.name);
        }}
        onBootstrapStateChange={(state) => {
          setBootstrapState(state);
          if (state.status === "loading") {
            setActiveProjectName(null);
          }
        }}
      />
      {activeProjectName ? (
        <div className="pointer-events-none absolute top-4 left-4 z-10 hidden sm:block">
          <div className="rounded-full border border-white/14 bg-black/40 px-3 py-1.5 text-sm text-white/84 backdrop-blur">
            <span className="font-measurement text-[11px] uppercase tracking-[0.18em] text-white/45">
              Project
            </span>
            <span className="ml-2 font-medium tracking-tight text-white">{activeProjectName}</span>
          </div>
        </div>
      ) : null}
      {bootstrapState.status === "loading" ? (
        <div className="pointer-events-none absolute top-4 left-4 z-10 hidden sm:block">
          <div className="rounded-full border border-white/12 bg-black/34 px-3 py-1.5 text-sm text-white/62 backdrop-blur">
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
      <EditorCanvas />
    </main>
  );
}
