"use client";

import { useState } from "react";
import EditorCanvas from "@/components/editor/EditorCanvas";
import { EditorProjectBootstrap } from "@/components/editor/EditorProjectBootstrap";

type EditorPageShellProps = {
  projectId?: string;
};

export function EditorPageShell({ projectId }: EditorPageShellProps) {
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);

  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-neutral-950 text-white">
      <EditorProjectBootstrap
        projectId={projectId}
        onProjectResolved={(project) => {
          setActiveProjectName(project.name);
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
      <EditorCanvas />
    </main>
  );
}
