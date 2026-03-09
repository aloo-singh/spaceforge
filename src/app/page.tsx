export default function HomePage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-neutral-950 text-white">
      <div className="absolute left-4 top-4 z-10 rounded-lg bg-black/50 px-3 py-2 text-sm backdrop-blur">
        SpaceForge MVP
      </div>
      <div id="editor-root" className="h-full w-full" />
    </main>
  );
}