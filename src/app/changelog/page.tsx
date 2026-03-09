export default function ChangelogPage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Changelog</h1>

        <p className="mt-4 text-sm leading-relaxed text-foreground/80">
          What changed in each SpaceForge milestone.
        </p>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.2.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-09</span>
          </div>

          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
            <li>Added the first room drawing flow</li>
            <li>You can now place snapped corners to create a rectangular room</li>
            <li>Added a live drawing preview while placing walls</li>
            <li>Added blue interactive editor visuals for drawing</li>
            <li>Added a manual light and dark theme switch</li>
            <li>Kept smooth pan and zoom controls while drawing</li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.1.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-09</span>
          </div>

          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
            <li>Set up the SpaceForge project foundation</li>
            <li>Added the first PixiJS editor canvas</li>
            <li>Rendered the first grid background</li>
            <li>Introduced light and dark mode foundations</li>
            <li>Started shaping the editor route and product structure</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
