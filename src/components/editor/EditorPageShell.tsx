import EditorCanvas from "@/components/editor/EditorCanvas";
import { EditorProjectBootstrap } from "@/components/editor/EditorProjectBootstrap";

type EditorPageShellProps = {
  projectId?: string;
};

export function EditorPageShell({ projectId }: EditorPageShellProps) {
  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-neutral-950 text-white">
      <EditorProjectBootstrap projectId={projectId} />
      <EditorCanvas />
    </main>
  );
}
