import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[#f8f6ef] text-[#161616]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,#ffd45e_0%,transparent_50%),radial-gradient(circle_at_85%_25%,#9fd9ff_0%,transparent_45%),radial-gradient(circle_at_65%_80%,#ffc7bf_0%,transparent_40%)]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-6xl flex-col justify-center px-6 py-20 sm:px-10">
        <p className="mb-5 inline-flex w-fit rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium tracking-wide uppercase">
          SpaceForge • Floor Plan Editor
        </p>

        <h1 className="max-w-4xl text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
          Plan spaces visually.
          <br />
          Edit layouts in millimetres.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-black/75 sm:text-lg">
          This is a temporary homepage inspired by Mural&apos;s clear intro style.
          Jump straight into the editor to pan, zoom, and build precise plans.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="h-11 rounded-full px-6 text-sm">
            <Link href="/editor">
              Open Editor
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs text-black/70">
            No signup required for local MVP flow
          </div>
        </div>
      </section>
    </main>
  );
}
