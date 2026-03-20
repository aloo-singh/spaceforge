"use client";

import Link from "next/link";
import { CSSProperties, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Safari } from "@/components/ui/safari";
import { Button } from "@/components/ui/button";

function revealClass(isVisible: boolean) {
  return [
    "transform-gpu transition-all duration-[1350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:transition-none",
    isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
  ].join(" ");
}

function revealStyle(delayMs: number): CSSProperties {
  return {
    transitionDelay: `${delayMs}ms`,
  };
}

export function HomeHeroContent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsVisible(true);
    }, 420);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl flex-col justify-center gap-10 px-6 py-16 sm:px-10 lg:gap-14 lg:py-18">
      <div className="max-w-5xl">
        <h1
          className={`${revealClass(isVisible)} text-[2.2rem] leading-[1.02] font-semibold tracking-tight sm:text-5xl md:text-[3.5rem] lg:text-[4.8rem]`}
          style={revealStyle(0)}
        >
          <span className="block whitespace-nowrap">Sketch home layouts</span>
          <span className="block">in seconds</span>
        </h1>

        <div className={revealClass(isVisible)} style={revealStyle(320)}>
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
            <p className="text-sm text-foreground/42">For quick layout ideas, not perfect plans.</p>
          </div>
        </div>
      </div>

      <div className={`${revealClass(isVisible)} pt-1 sm:pt-2`} style={revealStyle(700)}>
        <Safari
          url="spaceforge.app"
          imageSrc="/images/home/editor-hero.png?v=20260318"
          className="w-full"
        />
      </div>
    </section>
  );
}
