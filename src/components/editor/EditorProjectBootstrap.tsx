"use client";

/**
 * EditorProjectBootstrap — Project Loading & Persistence Orchestration
 *
 * PERSISTENCE STRATEGY:
 * ====================
 * This component manages the loading and recovery of projects, with careful separation
 * between PERSISTENT and TRANSIENT data:
 *
 * PERSISTENT DATA (saved to IndexedDB + localStorage):
 * - Project document (rooms, floors, geometry, export config, etc.)
 * - Undo/redo history stack (up to 100 snapshots per project)
 * - Project metadata (id, name, lastModified, thumbnail)
 *
 * TRANSIENT STATE (NOT saved, reset on load via loadProjectDocument()):
 * - Camera viewport state (position, zoom, rotation)
 * - Selected items (room, wall, opening, interior asset)
 * - Multi-selection array
 * - Draft state (rooms being drawn)
 * - Modal/rename sessions
 * - Clipboard state
 * - Pending camera fit operations
 *
 * RECOVERY BEHAVIOR:
 * When a project is loaded or recovered:
 * 1. Document + undo/redo history are restored from persistence
 * 2. loadProjectDocument() automatically resets all transient state to safe defaults
 * 3. Camera is positioned to fit the project layout
 * 4. User is left with a clean, predictable editor state
 *
 * This ensures data is never silently lost while keeping the editor in a valid state.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { areDocumentsEqual, cloneDocumentState, buildPersistedHistorySnapshot } from "@/lib/editor/persistedHistory";
import {
  createOrFetchAnonymousUser,
  isProjectsApiUnavailableError,
  ProjectApiError,
  isSpecificProjectNotFoundError,
  updateProject,
  fetchProjectSafely,
  fetchProjects,
  finalizeUnsavedProject,
} from "@/lib/projects/clientApi";
import {
  clearActiveProjectId,
  getOrCreateAnonymousClientToken,
  loadActiveProjectId,
  saveActiveProjectId,
} from "@/lib/projects/clientIdentity";
import { ensureFirstProject } from "@/lib/projects/bootstrap";
import {
  INITIAL_PIXELS_PER_MM,
  NEW_PROJECT_INITIAL_PIXELS_PER_MM,
} from "@/lib/editor/constants";
import type { ProjectRecord } from "@/lib/projects/types";
import { saveProjectDocument, checkForCachedProjectRecovery } from "@/lib/projects/projectDocumentPersistence";
import { useEditorStore } from "@/stores/editorStore";

const PROJECT_AUTOSAVE_DEBOUNCE_MS = 800;
const PROJECT_THUMBNAIL_DEBOUNCE_MS = 1400;
const PROJECT_THUMBNAIL_IDLE_TIMEOUT_MS = 1200;
const PROJECT_HISTORY_STATE_LIMIT = 100;
const NEW_PROJECT_OPEN_CAMERA_OPTIONS = {
  emptyLayoutPixelsPerMm: NEW_PROJECT_INITIAL_PIXELS_PER_MM,
} as const;

function isFreshEmptyProjectBootstrapState(
  document: ReturnType<typeof cloneDocumentState>,
  camera: ReturnType<typeof useEditorStore.getState>["camera"]
) {
  return (
    document.rooms.length === 0 &&
    camera.xMm === 0 &&
    camera.yMm === 0 &&
    camera.pixelsPerMm === INITIAL_PIXELS_PER_MM
  );
}

function getDocumentSignature(document: ReturnType<typeof cloneDocumentState>) {
  return JSON.stringify(document);
}

function getThumbnailDocumentSignature(document: ReturnType<typeof cloneDocumentState>) {
  return JSON.stringify({
    rooms: document.rooms,
  });
}

function scheduleIdleTask(callback: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const idleCallbackId = window.requestIdleCallback(callback, {
      timeout: PROJECT_THUMBNAIL_IDLE_TIMEOUT_MS,
    });

    return () => {
      window.cancelIdleCallback(idleCallbackId);
    };
  }

  const timeoutId = globalThis.setTimeout(callback, 0);
  return () => {
    globalThis.clearTimeout(timeoutId);
  };
}

// Attempt to recover a project from local persistence if it's fresher than the server version.
// RECOVERY SEMANTICS: Only persistent data (document + undo history) is restored.
// All transient state (camera, selections, drafts, sessions) is reset by loadProjectDocument() to safe defaults.
// This ensures recovery is predictable and never leaves the editor in an invalid state.
async function attemptProjectRecovery(
  projectId: string,
  serverLastModified: string
): Promise<{
  didRecover: boolean;
  recoveredDocument?: ReturnType<typeof cloneDocumentState>;
  historyStack?: ReturnType<typeof cloneDocumentState>[];
  historyIndex?: number;
}> {
  try {
    const recovery = await checkForCachedProjectRecovery(projectId, serverLastModified);
    if (recovery.shouldRecover && recovery.cachedDoc) {
      const recoveredDocument = cloneDocumentState(recovery.cachedDoc.document);
      // Show calm recovery confirmation to user — non-alarming, just reassuring
      toast.success("Project recovered from local cache", {
        description: "Your latest changes have been restored.",
        duration: 3500,
      });
      return {
        didRecover: true,
        recoveredDocument,
        historyStack: recovery.cachedDoc.historyStack,
        historyIndex: recovery.cachedDoc.historyIndex,
      };
    }
  } catch (error) {
    console.error("Error checking for project recovery.", error);
  }
  return { didRecover: false };
}

type EditorProjectBootstrapProps = {
  projectId?: string;
  generateThumbnailDataUrl?: (() => Promise<string | null>) | null;
  onProjectResolved?: (project: Pick<ProjectRecord, "id" | "name">) => void;
  onBootstrapStateChange?: (
    state:
      | { status: "loading" }
      | { status: "ready" }
      | { status: "error"; message: string }
  ) => void;
};

export function EditorProjectBootstrap({
  projectId,
  generateThumbnailDataUrl = null,
  onProjectResolved,
  onBootstrapStateChange,
}: EditorProjectBootstrapProps) {
  const router = useRouter();
  const document = useEditorStore((state) => state.document);
  const history = useEditorStore((state) => state.history);
  const fitCameraOnProjectOpen = useEditorStore((state) => state.fitCameraOnProjectOpen);
  const loadProjectDocument = useEditorStore((state) => state.loadProjectDocument);
  const resetCanvas = useEditorStore((state) => state.resetCanvas);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const clientTokenRef = useRef<string | null>(null);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const lastSyncedThumbnailSignatureRef = useRef<string | null>(null);
  const projectNameRef = useRef<string>("");
  const isBootstrappingRef = useRef(true);
  const hasProjectBeenFinalizedRef = useRef(false);
  const previousRoomCountRef = useRef(0);
  const generateThumbnailDataUrlRef = useRef(generateThumbnailDataUrl);
  const onProjectResolvedRef = useRef(onProjectResolved);
  const onBootstrapStateChangeRef = useRef(onBootstrapStateChange);

  useEffect(() => {
    generateThumbnailDataUrlRef.current = generateThumbnailDataUrl;
  }, [generateThumbnailDataUrl]);

  useEffect(() => {
    onProjectResolvedRef.current = onProjectResolved;
  }, [onProjectResolved]);

  useEffect(() => {
    onBootstrapStateChangeRef.current = onBootstrapStateChange;
  }, [onBootstrapStateChange]);

  useEffect(() => {
    let isCancelled = false;
    isBootstrappingRef.current = true;
    onBootstrapStateChangeRef.current?.({ status: "loading" });

    const bootstrap = async () => {
      try {
        const clientToken = getOrCreateAnonymousClientToken();
        clientTokenRef.current = clientToken;

        await createOrFetchAnonymousUser(clientToken);
        const selectedProjectId = projectId ?? loadActiveProjectId();
        const selectedProject =
          selectedProjectId !== null
            ? await fetchProjectSafely(clientToken, selectedProjectId)
            : null;

        if (!selectedProject) {
          const projects = await fetchProjects(clientToken);
          const fallbackProjectId = loadActiveProjectId();
          const selectedProjectListItem =
            projects.find((project) => project.id === fallbackProjectId) ?? projects[0] ?? null;

          if (selectedProjectListItem) {
            const fallbackProject = await fetchProjectSafely(clientToken, selectedProjectListItem.id);
            if (!fallbackProject) {
              clearActiveProjectId();
              if (projectId) {
                router.replace("/projects");
              }
              isBootstrappingRef.current = false;
              onBootstrapStateChangeRef.current?.({ status: "ready" });
              return;
            }
            if (isCancelled) return;

            let fallbackDocument = cloneDocumentState(fallbackProject.document);

            // Check for recovery from local persistence
            const fallbackRecovery = await attemptProjectRecovery(
              fallbackProject.id,
              fallbackProject.updatedAt
            );
            if (fallbackRecovery.didRecover && fallbackRecovery.recoveredDocument) {
              fallbackDocument = fallbackRecovery.recoveredDocument;
            }

            if (isCancelled) return;

            const currentState = useEditorStore.getState();
            const currentDocument = currentState.document;
            const projectOpenCameraOptions =
              fallbackDocument.rooms.length === 0 &&
              isFreshEmptyProjectBootstrapState(currentDocument, currentState.camera)
                ? NEW_PROJECT_OPEN_CAMERA_OPTIONS
                : undefined;
            if (!areDocumentsEqual(currentDocument, fallbackDocument)) {
              loadProjectDocument(fallbackDocument, projectOpenCameraOptions);
            } else {
              fitCameraOnProjectOpen(projectOpenCameraOptions);
            }
            useEditorStore.getState().setMaxFloors(fallbackProject.maxFloors);

            saveActiveProjectId(fallbackProject.id);
            projectNameRef.current = fallbackProject.name;
            onProjectResolvedRef.current?.({
              id: fallbackProject.id,
              name: fallbackProject.name,
            });
            lastSyncedSignatureRef.current = getDocumentSignature(fallbackDocument);
            lastSyncedThumbnailSignatureRef.current =
              fallbackProject.thumbnailDataUrl || fallbackDocument.rooms.length === 0
                ? getThumbnailDocumentSignature(fallbackDocument)
                : null;
            setActiveProjectId(fallbackProject.id);
            isBootstrappingRef.current = false;
            onBootstrapStateChangeRef.current?.({ status: "ready" });
            if (projectId && projectId !== fallbackProject.id) {
              router.replace(`/editor/${fallbackProject.id}`);
            }
            return;
          }

          const localDocument = cloneDocumentState(useEditorStore.getState().document);
          const project = await ensureFirstProject(clientToken, localDocument);
          if (isCancelled) return;

          if (project.document.rooms.length === 0) {
            fitCameraOnProjectOpen(NEW_PROJECT_OPEN_CAMERA_OPTIONS);
          }

          saveActiveProjectId(project.id);
          projectNameRef.current = project.name;
          onProjectResolvedRef.current?.({
            id: project.id,
            name: project.name,
          });
          lastSyncedSignatureRef.current = getDocumentSignature(project.document);
          lastSyncedThumbnailSignatureRef.current =
            project.thumbnailDataUrl || project.document.rooms.length === 0
              ? getThumbnailDocumentSignature(project.document)
              : null;
          setActiveProjectId(project.id);
          isBootstrappingRef.current = false;
          onBootstrapStateChangeRef.current?.({ status: "ready" });
          if (projectId && projectId !== project.id) {
            router.replace(`/editor/${project.id}`);
          }
          return;
        }

        if (projectId && selectedProject.id !== projectId) {
          router.replace(`/editor/${selectedProject.id}`);
        }

        let nextDocument = cloneDocumentState(selectedProject.document);

        // Check for recovery from local persistence
        const selectedRecovery = await attemptProjectRecovery(
          selectedProject.id,
          selectedProject.updatedAt
        );
        if (selectedRecovery.didRecover && selectedRecovery.recoveredDocument) {
          nextDocument = selectedRecovery.recoveredDocument;
        }

        if (isCancelled) return;

        const currentState = useEditorStore.getState();
        const currentDocument = currentState.document;
        const projectOpenCameraOptions =
          nextDocument.rooms.length === 0 &&
          isFreshEmptyProjectBootstrapState(currentDocument, currentState.camera)
            ? NEW_PROJECT_OPEN_CAMERA_OPTIONS
            : undefined;
        if (!areDocumentsEqual(currentDocument, nextDocument)) {
          loadProjectDocument(nextDocument, projectOpenCameraOptions);
        } else {
          fitCameraOnProjectOpen(projectOpenCameraOptions);
        }
        useEditorStore.getState().setMaxFloors(selectedProject.maxFloors);

        saveActiveProjectId(selectedProject.id);
        projectNameRef.current = selectedProject.name;
        onProjectResolvedRef.current?.({
          id: selectedProject.id,
          name: selectedProject.name,
        });
        lastSyncedSignatureRef.current = getDocumentSignature(nextDocument);
        lastSyncedThumbnailSignatureRef.current =
          selectedProject.thumbnailDataUrl || nextDocument.rooms.length === 0
            ? getThumbnailDocumentSignature(nextDocument)
            : null;
        setActiveProjectId(selectedProject.id);
        isBootstrappingRef.current = false;
        onBootstrapStateChangeRef.current?.({ status: "ready" });
      } catch (error) {
        clearActiveProjectId();
        setActiveProjectId(null);
        resetCanvas();

        if (isSpecificProjectNotFoundError(error)) {
          onBootstrapStateChangeRef.current?.({
            status: "error",
            message: "This project could not be found.",
          });
          if (projectId) {
            router.replace("/projects");
          }
        } else if (isProjectsApiUnavailableError(error)) {
          onBootstrapStateChangeRef.current?.({
            status: "error",
            message: "Projects are unavailable right now. Retry after the projects API is available.",
          });
        } else if (error instanceof ProjectApiError && error.status === 404) {
          clearActiveProjectId();
          if (projectId) {
            router.replace("/projects");
          }
        } else {
          console.error("Failed to bootstrap editor project.", error);
          onBootstrapStateChangeRef.current?.({
            status: "error",
            message:
              error instanceof Error ? error.message : "Failed to load the current project.",
          });
        }
        if (isCancelled) return;
        isBootstrappingRef.current = false;
      }
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [fitCameraOnProjectOpen, loadProjectDocument, projectId, resetCanvas, router]);

  useEffect(() => {
    const clientToken = clientTokenRef.current;
    if (!clientToken || !activeProjectId || isBootstrappingRef.current) {
      return;
    }

    const nextDocument = cloneDocumentState(document);
    const nextSignature = getDocumentSignature(nextDocument);
    if (nextSignature === lastSyncedSignatureRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextDoc = cloneDocumentState(nextDocument);
      void updateProject(clientToken, activeProjectId, {
        document: nextDoc,
      })
        .then((project) => {
          lastSyncedSignatureRef.current = getDocumentSignature(project.document);
        })
        .catch((error) => {
          console.error("Failed to sync active project.", error);
        });
      // PERSISTENCE: Save ONLY the persistent document + undo history (no camera, selection, or UI state).
      // Transient state (camera position, selected items, draft, etc.) is intentionally NOT saved and will reset on recovery.
      const historySnapshot = buildPersistedHistorySnapshot(nextDoc, history, PROJECT_HISTORY_STATE_LIMIT);
      void saveProjectDocument(
        activeProjectId,
        projectNameRef.current,
        nextDoc,
        undefined,
        historySnapshot?.historyStack ?? [],
        historySnapshot?.historyIndex ?? 0
      ).catch((error) => {
        console.error("Failed to save project to dual-layer persistence.", error);
      });
    }, PROJECT_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeProjectId, document, history, generateThumbnailDataUrl]);

  useEffect(() => {
    const clientToken = clientTokenRef.current;
    if (!clientToken || !activeProjectId || isBootstrappingRef.current) {
      return;
    }

    const nextDocument = cloneDocumentState(document);
    const nextSignature = getThumbnailDocumentSignature(nextDocument);
    if (nextSignature === lastSyncedThumbnailSignatureRef.current) {
      return;
    }

    let isCancelled = false;
    let cancelIdleTask: (() => void) | null = null;
    const timeoutId = window.setTimeout(() => {
      cancelIdleTask = scheduleIdleTask(() => {
        void (async () => {
          const generator = generateThumbnailDataUrlRef.current;
          if (isCancelled) return;

          let thumbnailDataUrl: string | null = null;
          if (nextDocument.rooms.length > 0) {
            if (!generator) {
              return;
            }

            try {
              thumbnailDataUrl = await generator();
            } catch (error) {
              console.error("Failed to generate project thumbnail.", error);
              return;
            }
          }

          if (isCancelled) return;

          void updateProject(clientToken, activeProjectId, {
            thumbnailDataUrl,
          })
            .then((project) => {
              if (isCancelled) return;
              lastSyncedThumbnailSignatureRef.current = getThumbnailDocumentSignature(project.document);
            })
            .catch((error) => {
              console.error("Failed to sync project thumbnail.", error);
            });

          // PERSISTENCE: Save thumbnail metadata with document (persistent data only, no transient UI state).
          void saveProjectDocument(
            activeProjectId,
            projectNameRef.current,
            nextDocument,
            thumbnailDataUrl,
            [], // TODO: restore full undo stack in Step 6
            0
          ).catch((error) => {
            console.error("Failed to save project thumbnail to dual-layer persistence.", error);
          });
        })();
      });
    }, PROJECT_THUMBNAIL_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
      cancelIdleTask?.();
    };
  }, [activeProjectId, document]);

  // Finalize unsaved projects when the first room is created
  useEffect(() => {
    const clientToken = clientTokenRef.current;
    if (
      !clientToken ||
      !activeProjectId ||
      isBootstrappingRef.current ||
      hasProjectBeenFinalizedRef.current
    ) {
      return;
    }

    const currentRoomCount = document.rooms.length;
    const previousRoomCount = previousRoomCountRef.current;

    // Detect when first room is created (transition from 0 to 1+ rooms)
    if (previousRoomCount === 0 && currentRoomCount > 0) {
      hasProjectBeenFinalizedRef.current = true;

      void finalizeUnsavedProject(clientToken, activeProjectId, {
        name: projectNameRef.current,
        document: cloneDocumentState(document),
      }).catch((error) => {
        console.error("Failed to finalize unsaved project.", error);
      });
    }

    previousRoomCountRef.current = currentRoomCount;
  }, [document]);

  return null;
}
