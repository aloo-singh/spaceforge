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
            <h2 className="text-2xl font-semibold">v0.7.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-11</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Export layouts as PNG images</li>
                <li>Theme-aware exports for light and dark mode</li>
                <li>Clean export composition with intentional padding</li>
                <li>Optional &quot;Designed by [name]&quot; signature for exported images</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improvements</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Export grid is simplified for clarity and shareability</li>
                <li>Export images now feel cleaner than raw canvas screenshots</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Internal</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Introduced a dedicated export composition pipeline</li>
                <li>Isolated PNG export utility for reuse</li>
                <li>Export rendering decoupled from live canvas rendering</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.6.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-11</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Major improvements</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Layouts now persist automatically in the browser</li>
                <li>Refreshing the page restores your layout</li>
                <li>Camera position and zoom are restored with the layout</li>
                <li>Autosave runs automatically during editing</li>
                <li>Autosave now flushes when the page is refreshed or closed</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Reset canvas action with confirmation dialog</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Internal</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Versioned editor persistence layer</li>
                <li>Debounced autosave system</li>
                <li>Camera state synchronised with editor viewport</li>
                <li>Safe localStorage hydration with corruption protection</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.5.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-09</span>
          </div>

          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
            <li>Added wall resize handles for selected rooms</li>
            <li>Added corner resize handles for faster room reshaping</li>
            <li>Resizing now snaps cleanly to the grid</li>
            <li>Room resizing can be undone and redone</li>
            <li>Improved handle hover states and resize cursors</li>
            <li>Sharpened room label rendering on the canvas</li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.4.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-09</span>
          </div>

          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
            <li>Added undo and redo support with a simple command history</li>
            <li>Undo and redo now cover completed rooms and room renaming</li>
            <li>Selection and deselection changes can now be undone and redone</li>
            <li>Added editor toolbar buttons for undo and redo with disabled states</li>
            <li>Added keyboard shortcuts: Cmd/Ctrl+Z, Shift+Cmd+Z, Ctrl+Shift+Z, and Ctrl+Y</li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.3.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-09</span>
          </div>

          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
            <li>Added room selection to the editor</li>
            <li>Added room names directly on the plan</li>
            <li>Added a simple panel to rename the selected room</li>
            <li>Improved the flow between selecting rooms and drawing new ones</li>
            <li>Made room selection feel more intentional and easier to control</li>
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
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
