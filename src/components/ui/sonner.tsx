"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { useMobile } from "@/lib/use-mobile";

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  const { isMobile } = useMobile();

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      closeButton={false}
      richColors={false}
      position={isMobile ? "bottom-center" : "top-center"}
      visibleToasts={isMobile ? 1 : 3}
      gap={isMobile ? 8 : 14}
      offset={16}
      mobileOffset={{ bottom: 12, left: 12, right: 12, top: 12 }}
      toastOptions={{
        duration: isMobile ? 2600 : undefined,
        classNames: {
          toast: isMobile
            ? "w-[min(calc(100vw-1.5rem),22rem)] rounded-2xl px-3 py-2.5 shadow-lg"
            : undefined,
          title: isMobile ? "text-sm" : undefined,
          description: isMobile ? "text-[13px] leading-5" : undefined,
          actionButton: isMobile ? "min-h-8 rounded-lg px-2.5 text-xs" : undefined,
          cancelButton: isMobile ? "min-h-8 rounded-lg px-2.5 text-xs" : undefined,
          closeButton: isMobile ? "rounded-lg" : undefined,
        },
      }}
    />
  );
}
