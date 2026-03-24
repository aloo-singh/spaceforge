"use client";

import { create } from "zustand";

const EARLY_EXPLORER_STORAGE_KEY = "early_explorer";

type GamificationState = {
  earlyExplorer: boolean;
  hasHydratedEarlyExplorer: boolean;
  hydrateEarlyExplorer: () => void;
};

function readEarlyExplorerFlag() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const storage = window.localStorage;
    const rawValue = storage.getItem(EARLY_EXPLORER_STORAGE_KEY);

    if (rawValue === null) {
      storage.setItem(EARLY_EXPLORER_STORAGE_KEY, "true");
      return true;
    }

    return rawValue === "true";
  } catch {
    return true;
  }
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  earlyExplorer: true,
  hasHydratedEarlyExplorer: false,
  hydrateEarlyExplorer: () => {
    if (get().hasHydratedEarlyExplorer) return;

    set({
      earlyExplorer: readEarlyExplorerFlag(),
      hasHydratedEarlyExplorer: true,
    });
  },
}));
