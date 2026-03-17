import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
          <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.09)]">
            <div className="flex items-center gap-2 border-b border-black/10 px-5 py-4">
              <span className="size-2 rounded-full bg-black/15" />
              <span className="size-2 rounded-full bg-blue-500/70" />
              <span className="size-2 rounded-full bg-black/15" />
            </div>

            <div className="grid gap-5 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:32px_32px] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-measurement text-[11px] font-semibold tracking-[0.2em] text-blue-500 uppercase">
                    Live Preview
                  </p>
                  <p className="text-sm text-foreground/60">A simple sketch surface with precise feedback.</p>
                </div>
                <div className="rounded-full border border-black/10 bg-background px-3 py-1 font-measurement text-[11px] text-foreground/55">
                  8.4m x 6.2m
                </div>
              </div>

              <div className="relative min-h-[320px] rounded-2xl border border-black/10 bg-white/90 p-4 sm:min-h-[380px] sm:p-5">
                <div className="absolute left-4 top-4 rounded-full border border-blue-500/20 bg-blue-500/8 px-3 py-1 font-measurement text-[11px] text-blue-500 sm:left-6 sm:top-6">
                  Living Area
                </div>
                <div className="absolute inset-x-4 bottom-4 top-16 rounded-[1.4rem] border-2 border-blue-500/85 bg-blue-500/[0.05] sm:inset-x-5 sm:bottom-5 sm:top-18">
                  <div className="absolute left-[17%] top-0 h-full border-l border-dashed border-blue-500/30" />
                  <div className="absolute left-0 right-0 top-[42%] border-t border-dashed border-blue-500/30" />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-background px-2 font-measurement text-[10px] text-foreground/45">
                    8.4m
                  </div>
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 rounded-full bg-background px-2 font-measurement text-[10px] text-foreground/45">
                    6.2m
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
