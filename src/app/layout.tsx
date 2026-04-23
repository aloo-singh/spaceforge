import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Badge } from "@/components/ui/badge";
import {
  appSansFont,
  appUiMonoFont,
  appUiSansFont,
  measurementMonoFont,
} from "@/lib/fonts";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { AppToaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  metadataBase: new URL("https://spaceforge.app"),
  title: "[s]paceforge - Sketch home layouts in seconds",
  description:
    "Draw and explore home layouts in seconds. No setup, no signup. Just sketch and iterate.",
  openGraph: {
    title: "Spaceforge",
    description:
      "Draw and explore home layouts in seconds. No setup, no signup. Just sketch and iterate.",
    url: "https://spaceforge.app",
    siteName: "Spaceforge",
    images: ["/opengraph-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spaceforge",
    description:
      "Draw and explore home layouts in seconds. No setup, no signup. Just sketch and iterate.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", appSansFont.variable)}>
      <body
        className={`${appUiSansFont.variable} ${appUiMonoFont.variable} ${measurementMonoFont.variable} antialiased`}
      >
        <ThemeProvider>
          <AppToaster />
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-black/10 bg-background/95 px-4 backdrop-blur sm:px-6">
            <Link href="/?skipRedirect=true" aria-label="SpaceForge home" className="flex items-center gap-2">
              <BrandWordmark />
              <Badge
                variant="outline"
                className="rounded-md border-foreground/10 bg-foreground/[0.03] px-1.5 py-0.5 font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/55 uppercase"
              >
                Preview
              </Badge>
            </Link>
            <nav className="flex items-center text-sm">
              <Link
                href="/projects"
                className="text-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground"
              >
                Projects
              </Link>
              <Link
                href="/editor"
                className="ml-4 text-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground"
              >
                Editor
              </Link>
              <Link href="/changelog" className="ml-4 leading-none">
                <Badge variant="outline" className="text-[11px] font-medium">
                  {APP_VERSION_LABEL}
                </Badge>
              </Link>
            </nav>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
