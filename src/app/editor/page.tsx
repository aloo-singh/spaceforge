import EditorCanvas from "@/components/editor/EditorCanvas";

export default function EditorPage() {
  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-neutral-950 text-white">
      <EditorCanvas />
    </main>
  );
}
