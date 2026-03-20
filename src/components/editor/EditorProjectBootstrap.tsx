"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { areDocumentsEqual, cloneDocumentState } from "@/lib/editor/persistedHistory";
import { createOrFetchAnonymousUser, createProject, fetchProject, fetchProjects, updateProject } from "@/lib/projects/clientApi";
import { getOrCreateAnonymousClientToken, loadActiveProjectId, saveActiveProjectId } from "@/lib/projects/clientIdentity";
import { DEFAULT_PROJECT_NAME } from "@/lib/projects/defaults";
import { useEditorStore } from "@/stores/editorStore";

const PROJECT_AUTOSAVE_DEBOUNCE_MS = 800;

function getDocumentSignature(document: ReturnType<typeof cloneDocumentState>) {
  return JSON.stringify(document);
}

type EditorProjectBootstrapProps = {
  projectId?: string;
};

export function EditorProjectBootstrap({ projectId }: EditorProjectBootstrapProps) {
  const router = useRouter();
  const document = useEditorStore((state) => state.document);
  const loadProjectDocument = useEditorStore((state) => state.loadProjectDocument);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const clientTokenRef = useRef<string | null>(null);
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const isBootstrappingRef = useRef(true);

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      try {
        const clientToken = getOrCreateAnonymousClientToken();
        clientTokenRef.current = clientToken;

        await createOrFetchAnonymousUser(clientToken);
        const selectedProjectId = projectId ?? loadActiveProjectId();
        const selectedProject =
          selectedProjectId !== null
            ? await fetchProject(clientToken, selectedProjectId).catch((error) => {
                if (projectId) {
                  throw error;
                }
                return null;
              })
            : null;

        if (!selectedProject) {
          const projects = await fetchProjects(clientToken);
          const fallbackProjectId = loadActiveProjectId();
          const selectedProjectListItem =
            projects.find((project) => project.id === fallbackProjectId) ?? projects[0] ?? null;

          if (selectedProjectListItem) {
            const fallbackProject = await fetchProject(clientToken, selectedProjectListItem.id);
            if (isCancelled) return;

            const fallbackDocument = cloneDocumentState(fallbackProject.document);
            const currentDocument = useEditorStore.getState().document;
            if (!areDocumentsEqual(currentDocument, fallbackDocument)) {
              loadProjectDocument(fallbackDocument);
            }

            saveActiveProjectId(fallbackProject.id);
            lastSyncedSignatureRef.current = getDocumentSignature(fallbackDocument);
            setActiveProjectId(fallbackProject.id);
            isBootstrappingRef.current = false;
            if (projectId && projectId !== fallbackProject.id) {
              router.replace(`/editor/${fallbackProject.id}`);
            }
            return;
          }

          const localDocument = cloneDocumentState(useEditorStore.getState().document);
          const project = await createProject(clientToken, {
            name: DEFAULT_PROJECT_NAME,
            document: localDocument,
          });
          if (isCancelled) return;

          saveActiveProjectId(project.id);
          lastSyncedSignatureRef.current = getDocumentSignature(project.document);
          setActiveProjectId(project.id);
          isBootstrappingRef.current = false;
          if (projectId && projectId !== project.id) {
            router.replace(`/editor/${project.id}`);
          }
          return;
        }

        const nextDocument = cloneDocumentState(selectedProject.document);
        const currentDocument = useEditorStore.getState().document;
        if (!areDocumentsEqual(currentDocument, nextDocument)) {
          loadProjectDocument(nextDocument);
        }

        saveActiveProjectId(selectedProject.id);
        lastSyncedSignatureRef.current = getDocumentSignature(nextDocument);
        setActiveProjectId(selectedProject.id);
        isBootstrappingRef.current = false;
      } catch (error) {
        console.error("Failed to bootstrap editor project.", error);
        if (isCancelled) return;
        isBootstrappingRef.current = false;
      }
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [loadProjectDocument, projectId, router]);

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
      void updateProject(clientToken, activeProjectId, {
        document: nextDocument,
      })
        .then((project) => {
          lastSyncedSignatureRef.current = getDocumentSignature(project.document);
        })
        .catch((error) => {
          console.error("Failed to sync active project.", error);
        });
    }, PROJECT_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeProjectId, document]);

  return null;
}
