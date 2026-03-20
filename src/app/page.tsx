import { GridPattern } from "@/components/ui/grid-pattern";
import { HomeHeroContent } from "@/components/home/home-hero-content";

export default function HomePage() {
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

      <HomeHeroContent />
    </main>
  );
}
