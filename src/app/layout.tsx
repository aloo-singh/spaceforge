import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", inter.variable)}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <header className="flex h-14 items-center justify-between border-b border-black/10 bg-background/90 px-4 backdrop-blur sm:px-6">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              SpaceForge
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
                  v0.1.0
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
