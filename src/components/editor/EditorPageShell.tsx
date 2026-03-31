"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import EditorCanvas from "@/components/editor/EditorCanvas";
import { EditorProjectBootstrap } from "@/components/editor/EditorProjectBootstrap";
import { EditorProjectChrome } from "@/components/editor/EditorProjectChrome";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { Button } from "@/components/ui/button";
import type { EditorOnboardingHintId } from "@/lib/editor/onboardingHints";
import { useEditorStore } from "@/stores/editorStore";
import { useGamificationStore } from "@/stores/useGamificationStore";

type EditorPageShellProps = {
  projectId?: string;
};

const LOADING_OVERLAY_EXIT_DURATION_MS = 240;

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
  const roomCount = useEditorStore((state) => state.document.rooms.length);
  const hydrateEarlyExplorer = useGamificationStore((state) => state.hydrateEarlyExplorer);
  const [baselineRoomCount, setBaselineRoomCount] = useState<number | null>(null);
  const [isLoadingOverlayVisible, setIsLoadingOverlayVisible] = useState(projectId !== undefined);
  const loadingOverlayExitTimerRef = useRef<number | null>(null);
  const isProjectBootstrapLoading = projectId !== undefined && bootstrapState.status === "loading";
  const shouldRenderLoadingOverlay = projectId !== undefined && isLoadingOverlayVisible;
  const shouldHideCanvasDuringBootstrap = projectId !== undefined && bootstrapState.status !== "ready";
  const handleThumbnailGeneratorChange = (nextGenerator: (() => Promise<string | null>) | null) => {
    setGenerateThumbnailDataUrl(() => nextGenerator);
  };
  const hasMeaningfulEditorInteraction =
    bootstrapState.status === "ready" && baselineRoomCount !== null && roomCount > baselineRoomCount;

  useEffect(() => {
    hydrateEarlyExplorer();
  }, [hydrateEarlyExplorer]);

  useEffect(() => {
    return () => {
      if (loadingOverlayExitTimerRef.current !== null) {
        window.clearTimeout(loadingOverlayExitTimerRef.current);
      }
    };
  }, []);

  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-neutral-950 text-white">
      <EditorProjectBootstrap
        projectId={projectId}
        generateThumbnailDataUrl={generateThumbnailDataUrl}
        onProjectResolved={(project) => {
          setActiveProject(project);
        }}
        onBootstrapStateChange={(state) => {
          if (loadingOverlayExitTimerRef.current !== null) {
            window.clearTimeout(loadingOverlayExitTimerRef.current);
            loadingOverlayExitTimerRef.current = null;
          }

          setBootstrapState(state);
          if (state.status === "loading") {
            setIsLoadingOverlayVisible(true);
            setActiveProject(null);
            setBaselineRoomCount(null);
          }
          if (state.status === "error") {
            setIsLoadingOverlayVisible(false);
            setBaselineRoomCount(null);
          }
          if (state.status === "ready") {
            setIsLoadingOverlayVisible(true);
            setBaselineRoomCount(useEditorStore.getState().document.rooms.length);
            loadingOverlayExitTimerRef.current = window.setTimeout(() => {
              setIsLoadingOverlayVisible(false);
              loadingOverlayExitTimerRef.current = null;
            }, LOADING_OVERLAY_EXIT_DURATION_MS);
          }
        }}
      />
      {shouldRenderLoadingOverlay ? (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center bg-neutral-950 transition-opacity duration-[240ms] ${
            isProjectBootstrapLoading ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/72 backdrop-blur">
            <LoaderCircle className="size-4 animate-spin text-white/44" aria-hidden="true" />
            <AnimatedShinyText shimmerWidth={72} className="text-sm text-white/72 dark:via-white/90">
              Loading project...
            </AnimatedShinyText>
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
          leftSidebarContent={
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-border/70 px-3 py-3 sm:px-4">
                <EditorProjectChrome
                  projectId={activeProject?.id ?? null}
                  projectName={activeProject?.name ?? null}
                  isLoading={bootstrapState.status === "loading"}
                  variant="sidebar"
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
              </div>
              <div className="flex-1 p-3 sm:p-4" />
            </div>
          }
        />
      ) : null}
      <FeedbackWidget
        pageContext="editor"
        projectId={activeProject?.id ?? null}
        promptEligible={bootstrapState.status === "ready" && hasMeaningfulEditorInteraction}
        surface="dark"
        getMetadata={() => ({
          roomCount,
          bootstrapStatus: bootstrapState.status,
          trigger: "first-room-created",
        })}
      />
    </main>
  );
}
