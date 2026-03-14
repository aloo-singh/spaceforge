import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";

export const appSansFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const appUiSansFont = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const appUiMonoFont = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const measurementMonoFont = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const UI_TEXT_FONT_FAMILY = appSansFont.style.fontFamily;
export const MEASUREMENT_TEXT_FONT_FAMILY = `${measurementMonoFont.style.fontFamily}, ${appUiMonoFont.style.fontFamily}, ui-monospace, monospace`;
