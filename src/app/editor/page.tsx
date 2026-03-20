import EditorCanvas from "@/components/editor/EditorCanvas";
import { EditorProjectBootstrap } from "@/components/editor/EditorProjectBootstrap";

export default function EditorPage() {
  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-neutral-950 text-white">
      <EditorProjectBootstrap />
      <EditorCanvas />
    </main>
  );
}
