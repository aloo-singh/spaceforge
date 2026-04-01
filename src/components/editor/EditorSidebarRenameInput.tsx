import { forwardRef } from "react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EDITOR_SIDEBAR_RENAME_INPUT_CLASS =
  "h-5 min-w-0 border-zinc-300/80 bg-white/90 py-0 leading-none dark:border-input dark:bg-background";

type EditorSidebarRenameInputProps = ComponentProps<typeof Input>;

export const EditorSidebarRenameInput = forwardRef<
  HTMLInputElement,
  EditorSidebarRenameInputProps
>(function EditorSidebarRenameInput({ className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      className={cn(EDITOR_SIDEBAR_RENAME_INPUT_CLASS, className)}
      {...props}
    />
  );
});
