import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Safari } from "@/components/ui/safari";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl flex-col justify-center gap-14 px-6 py-16 sm:px-10 lg:gap-18 lg:py-18">
        <div className="max-w-5xl">
          <h1 className="text-[2.2rem] leading-[1.02] font-semibold tracking-tight sm:text-5xl md:text-[3.5rem] lg:text-[4.8rem]">
            <span className="block whitespace-nowrap">Sketch home layouts</span>
            <span className="block">in seconds</span>
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-7 text-foreground/68 sm:text-lg">
            No setup. No complexity. Just draw and explore.
          </p>

          <div className="mt-8 flex flex-col items-start gap-2.5">
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
        </div>

        <div className="flex flex-col items-center gap-5 text-center">
          <Safari
            url="spaceforge.app"
            imageSrc="/images/home/editor-hero.png?v=20260318"
            className="w-full"
          />
          <p className="max-w-sm text-sm text-foreground/42">For quick layout ideas, not perfect plans.</p>
        </div>
      </section>
    </main>
  );
}
