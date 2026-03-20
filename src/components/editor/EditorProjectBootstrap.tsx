"use client";

import { useEffect, useRef, useState } from "react";
import { areDocumentsEqual, cloneDocumentState } from "@/lib/editor/persistedHistory";
import { createOrFetchAnonymousUser, createProject, fetchProject, fetchProjects, updateProject } from "@/lib/projects/clientApi";
import { getOrCreateAnonymousClientToken, loadActiveProjectId, saveActiveProjectId } from "@/lib/projects/clientIdentity";
import { useEditorStore } from "@/stores/editorStore";

const PROJECT_AUTOSAVE_DEBOUNCE_MS = 800;
const DEFAULT_PROJECT_NAME = "Untitled project";

function getDocumentSignature(document: ReturnType<typeof cloneDocumentState>) {
  return JSON.stringify(document);
}

export function EditorProjectBootstrap() {
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
        const projects = await fetchProjects(clientToken);
        const preferredProjectId = loadActiveProjectId();
        const selectedProjectListItem =
          projects.find((project) => project.id === preferredProjectId) ?? projects[0] ?? null;

        if (!selectedProjectListItem) {
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
          return;
        }

        const project = await fetchProject(clientToken, selectedProjectListItem.id);
        if (isCancelled) return;

        const nextDocument = cloneDocumentState(project.document);
        const currentDocument = useEditorStore.getState().document;
        if (!areDocumentsEqual(currentDocument, nextDocument)) {
          loadProjectDocument(nextDocument);
        }

        saveActiveProjectId(project.id);
        lastSyncedSignatureRef.current = getDocumentSignature(nextDocument);
        setActiveProjectId(project.id);
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
  }, [loadProjectDocument]);

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
