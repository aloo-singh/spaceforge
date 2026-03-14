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
            <h2 className="text-2xl font-semibold">v0.12.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-14</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Persisted undo/redo history
              </h3>
              <p className="mt-2">
                Undo and redo history now survives refresh and browser restart, making the editor
                feel much more trustworthy during active work.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Persisted undo/redo history alongside layout and camera state</li>
                <li>Restored history position and redo availability after refresh</li>
                <li>Preserved branch-after-undo behaviour across reloads</li>
                <li>Added bounded history persistence to prevent unbounded storage growth</li>
                <li>Improved hydration safety with explicit fallback behaviour</li>
                <li>Valid layout/camera now restore even if persisted history is invalid</li>
                <li>Added a narrow debug helper for clearing persisted editor state</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.11.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-13</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Transform feedback</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Move and resize now share one coherent transform feedback system</li>
                <li>Active transforms keep the selected room anchored while the snapped destination preview moves independently</li>
                <li>Resize interactions now show the same original reference and destination feedback language as move</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Polish</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Committed transforms now settle into place with a quick eased animation and a brief fading destination glow</li>
                <li>Room labels now animate with the settling room instead of jumping to the final position</li>
                <li>Transform pacing, easing, and glow tuning were tightened to make move and resize feel more consistent</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Quality</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Transform preview state now clears more reliably across quick repeats, cancel paths, and end-of-interaction cleanup</li>
                <li>No changes to geometry rules, persistence, export, or undo/redo semantics</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.10.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-13</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>You can now drag a room by its label to move the whole room</li>
                <li>Room movement is now fully grid-aligned, matching the editor&apos;s existing snap behaviour</li>
                <li>Active label drags now show a subtle ghost silhouette of the room&apos;s starting position</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improvements</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Clicking a room label still selects normally, with a small pointer threshold before drag begins</li>
                <li>Whole-room movement preserves room shape exactly while previewing the snapped destination live</li>
                <li>Each label drag still commits as one clean undoable move instead of multiple history entries</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Quality</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Fixed a hydration mismatch on refresh when persisted editor state restored moved rooms on the client</li>
                <li>Move interaction feedback now clears cleanly on pointer up, cancel, blur, and missing-room failure paths</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.9.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-12</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Export</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>PNG export framing now auto-fits to actual room layout bounds instead of the live viewport</li>
                <li>Added export framing polish for very small layouts to keep composition visually balanced</li>
                <li>Export centering and spacing are tuned to keep breathing room, including when signatures are present</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Quality</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Export PNG is now disabled on empty canvases to prevent blank downloads</li>
                <li>Disabled export state now explains the requirement with a tooltip: &quot;Draw a room before exporting.&quot;</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Internal</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added reusable layout-bounds utilities for export composition</li>
                <li>Introduced dedicated auto-fit export framing utility for content-based camera setup</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.8.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-12</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added contextual onboarding hints for drawing, selection, resize, undo, export, and panning</li>
                <li>Hints now persist dismissed and completed state locally</li>
                <li>Added a final panning hint with workspace navigation guidance</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improvements</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Hint cards now use stronger contrast and subtle enter/exit transitions</li>
                <li>Newly created rooms are selected immediately and ready for instant renaming</li>
                <li>Drawing mode now shows a crosshair cursor for clearer affordance</li>
                <li>Wall edge hover highlight and refined resize cursors improve resize discoverability</li>
                <li>Wall and corner snap previews now interpolate briefly for smoother drag feel</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Export</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>PNG exports now omit selection-specific UI for cleaner output</li>
                <li>Live editor selection state remains unchanged during export</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6">
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
