import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
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
  title: "SpaceForge",
  description: "Floor plan editor built with Next.js and PixiJS.",
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
          <header className="flex h-14 items-center justify-between border-b border-black/10 bg-background/90 px-4 backdrop-blur sm:px-6">
            <Link href="/" aria-label="SpaceForge home" className="flex items-center gap-2">
              <BrandWordmark />
              <Badge
                variant="outline"
                className="rounded-md border-foreground/10 bg-foreground/[0.03] px-1.5 py-0.5 font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/55 uppercase"
              >
                Preview
              </Badge>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-foreground/80 hover:text-foreground">
                Home
              </Link>
              <Link href="/editor" className="text-foreground/80 hover:text-foreground">
                Editor
              </Link>
              <Link href="/changelog" className="leading-none">
                <Badge variant="outline" className="text-[11px] font-medium">
                  {APP_VERSION_LABEL}
                </Badge>
              </Link>
            </nav>
          </header>
          {children}
          <ThemeToggle className="fixed right-4 bottom-4 z-30" />
        </ThemeProvider>
      </body>
    </html>
  );
}
