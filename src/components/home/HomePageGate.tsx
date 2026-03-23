"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProjectPresence } from "@/lib/projects/clientApi";
import { getAnonymousClientToken } from "@/lib/projects/clientIdentity";
import { GridPattern } from "@/components/ui/grid-pattern";
import { HomeHeroContent } from "@/components/home/home-hero-content";

export function HomePageGate() {
  const router = useRouter();
  const [shouldShowHomepage, setShouldShowHomepage] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const routeVisitor = async () => {
      const clientToken = getAnonymousClientToken();
      if (!clientToken) {
        if (!isCancelled) {
          setShouldShowHomepage(true);
        }
        return;
      }

      try {
        const hasProjects = await fetchProjectPresence(clientToken);
        if (isCancelled) return;

        if (hasProjects) {
          router.replace("/projects");
          return;
        }
      } catch {
        // Fall back to the homepage if project presence cannot be determined.
      }

      if (!isCancelled) {
        setShouldShowHomepage(true);
      }
    };

    void routeVisitor();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <GridPattern
          width={20}
          height={20}
          x={-1}
          y={-1}
          className="[mask-image:linear-gradient(to_bottom_right,white_0%,white_14%,transparent_28%)] opacity-60"
        />
      </div>

      {shouldShowHomepage ? <HomeHeroContent /> : null}
    </main>
  );
}
