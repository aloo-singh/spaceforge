import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Badge } from "@/components/ui/badge";
import { VersionLink } from "@/components/version-link";
import { getAuthenticatedAdminUser } from "@/lib/supabase/admin";
import {
  appSansFont,
  appUiMonoFont,
  appUiSansFont,
  measurementMonoFont,
} from "@/lib/fonts";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminUser = await getAuthenticatedAdminUser();
  const isAdmin = adminUser !== null;
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
              <div className="ml-4">
                <VersionLink isAdmin={isAdmin} />
              </div>
            </nav>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
