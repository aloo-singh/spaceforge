import { useCallback, useEffect, useState } from "react";

type PanelStatePerProject = {
  isLeftSidebarCollapsed: boolean;
  isDesktopInspectorCollapsed: boolean;
  isPortraitInspectorCollapsed: boolean;
};

const STORAGE_KEY_PREFIX = "editor-panel-state-";

/**
 * Hook to persist and restore sidebar and inspector panel state per project
 */
export function usePersistentPanelState(projectId: string | null | undefined) {
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isDesktopInspectorCollapsed, setIsDesktopInspectorCollapsed] = useState(false);
  const [isPortraitInspectorCollapsed, setIsPortraitInspectorCollapsed] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load state from localStorage on mount and when projectId changes
  useEffect(() => {
    if (!projectId) {
      setIsHydrated(true);
      return;
    }

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`;
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        const state = JSON.parse(saved) as PanelStatePerProject;
        setIsLeftSidebarCollapsed(state.isLeftSidebarCollapsed ?? false);
        setIsDesktopInspectorCollapsed(state.isDesktopInspectorCollapsed ?? false);
        setIsPortraitInspectorCollapsed(state.isPortraitInspectorCollapsed ?? true);
      } else {
        // Reset to defaults for new project
        setIsLeftSidebarCollapsed(false);
        setIsDesktopInspectorCollapsed(false);
        setIsPortraitInspectorCollapsed(true);
      }
    } catch (error) {
      console.error("Failed to load panel state:", error);
    } finally {
      setIsHydrated(true);
    }
  }, [projectId]);

  // Save state to localStorage whenever it changes
  const saveState = useCallback(() => {
    if (!projectId) return;

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`;
      const state: PanelStatePerProject = {
        isLeftSidebarCollapsed,
        isDesktopInspectorCollapsed,
        isPortraitInspectorCollapsed,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save panel state:", error);
    }
  }, [projectId, isLeftSidebarCollapsed, isDesktopInspectorCollapsed, isPortraitInspectorCollapsed]);

  useEffect(() => {
    if (!isHydrated) return;
    saveState();
  }, [isHydrated, saveState]);

  return {
    isLeftSidebarCollapsed,
    setIsLeftSidebarCollapsed,
    isDesktopInspectorCollapsed,
    setIsDesktopInspectorCollapsed,
    isPortraitInspectorCollapsed,
    setIsPortraitInspectorCollapsed,
    isHydrated,
  };
}
