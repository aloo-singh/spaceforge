import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Safari } from "@/components/ui/safari";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <section className="mx-auto grid min-h-[calc(100vh-3.5rem)] w-full max-w-6xl items-center gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[minmax(0,31rem)_minmax(0,1fr)] lg:gap-16 lg:py-22">
        <div className="max-w-xl">
          <h1 className="max-w-[11ch] text-4xl leading-[1.02] font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Sketch home layouts
            <br />
            in seconds
          </h1>

          <p className="mt-6 max-w-md text-base leading-7 text-foreground/68 sm:text-lg">
            No setup. No complexity. Just draw and explore.
          </p>

          <div className="mt-7 flex flex-col items-start gap-2.5">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-blue-500 px-7 text-sm text-white shadow-[0_10px_24px_rgba(59,130,246,0.18)] hover:bg-blue-500/90"
            >
              <Link href="/editor">
                Start designing
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-sm text-foreground/52">Takes seconds. No signup required.</p>
          </div>

          <p className="mt-7 text-sm text-foreground/42">For quick layout ideas, not perfect plans.</p>
        </div>

        <div className="relative lg:-ml-3">
          <Safari
            url="spaceforge.app"
            imageSrc="/images/home/editor-hero.png"
            className="w-full overflow-hidden rounded-[1.6rem] border border-black/10 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.1)]"
          />
        </div>
      </section>
    </main>
  );
}
