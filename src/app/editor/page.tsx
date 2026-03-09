import EditorCanvas from "@/components/editor/EditorCanvas";

export default function EditorPage() {
  return (
    <main className="relative h-[calc(100vh-3.5rem)] w-screen overflow-hidden bg-neutral-950 text-white">
      <div className="absolute left-4 top-4 z-10 rounded-lg bg-black/50 px-3 py-2 text-sm backdrop-blur">
        SpaceForge Editor
      </div>
      <EditorCanvas />
    </main>
  );
}
