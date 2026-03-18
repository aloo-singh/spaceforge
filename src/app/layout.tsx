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

export const metadata: Metadata = {
  title: "spaceforge.app",
  description: "Sketch home layouts in seconds. No setup. No complexity. Just draw and explore.",
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
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-black/10 bg-background/95 px-4 backdrop-blur sm:px-6">
            <Link href="/" aria-label="SpaceForge home" className="flex items-center">
              <BrandWordmark />
            </Link>
            <nav className="flex items-center text-sm">
              <Link
                href="/editor"
                className="text-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground"
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
