"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { loadProjectCatalog } from "@/lib/projects/catalog";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Load project catalog on app start for future use
    void loadProjectCatalog();
  }, []);

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
