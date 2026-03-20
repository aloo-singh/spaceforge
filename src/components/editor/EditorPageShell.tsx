"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
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
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-center justify-between border-b border-white/8 bg-neutral-950/78 px-4 backdrop-blur sm:px-6">
        <div className="min-w-0">
          {bootstrapState.status === "loading" ? (
            <div className="text-sm text-white/58">Loading project...</div>
          ) : activeProjectName ? (
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="font-measurement text-[11px] uppercase tracking-[0.18em] text-white/40">
                Project
              </span>
              <span className="truncate text-sm font-medium tracking-tight text-white/90">
                {activeProjectName}
              </span>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-white/68 hover:bg-white/8 hover:text-white"
          >
            <Link href="/projects">
              <ArrowLeft className="size-4" />
              Projects
            </Link>
          </Button>
        </div>
      </div>
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
      {bootstrapState.status === "error" ? (
        <div className="absolute top-16 left-4 z-10 max-w-sm rounded-2xl border border-white/12 bg-black/60 p-4 shadow-lg backdrop-blur">
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
