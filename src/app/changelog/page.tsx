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
            <h2 className="text-2xl font-semibold">v0.28.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-19</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added adaptive snap-step resolution so editing precision now scales with zoom level instead of staying fixed to one grid increment</li>
                <li>Added a lightweight live scale overlay in the canvas with the current snap increment shown alongside the scale bar</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Room drawing, whole-room movement, rectangular resize, constrained vertex drag, and opening drag or resize now share one central active snap step</li>
                <li>The snap tiers are tuned so 0.5 m remains the main working mode, 0.1 m activates earlier for detail work, and 1.0 m is reserved for genuinely far-out views</li>
                <li>The scale overlay now avoids hydration mismatch by staying server and client stable until editor state hydration completes</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Adaptive snapping now feels more consistent across the editor&apos;s direct manipulation paths without adding new settings or heavy UI</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.27.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-19</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added the first wall-attached openings system with support for doors and windows on orthogonal room walls</li>
                <li>Selected walls now expose direct insertion actions so openings can be placed from the existing editor workflow without leaving the canvas context</li>
                <li>Selected openings now have a dedicated inspector panel with core controls such as width plus door-specific side and hinge settings</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Openings stay constrained to their host wall segment while moving and resizing, including on non-rectangular orthogonal room shapes</li>
                <li>Opening selection, deletion, persistence, and undo or redo now behave as part of the main editor model rather than as a temporary overlay system</li>
                <li>On-canvas width handles make opening sizing direct in the editor while preserving the project&apos;s low-clutter interaction model</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Moved openings into a dedicated render layer and tightened zoom-aware rendering so wall-attached elements stay legible at different scales</li>
                <li>Improved segment-local anchoring and selection emphasis so openings feel visually attached and easier to target precisely</li>
                <li>Restored editor undo and redo keyboard shortcuts cleanly alongside the expanded opening interaction model</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.26.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-19</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Introduced the first structured editor layout with clear top bar, canvas, and inspector zones</li>
                <li>Added a stable inspector surface with a selected-room panel and a calm empty state when nothing is selected</li>
                <li>Moved appearance control into Editor Settings with explicit System, Light, and Dark modes</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>The editor shell now keeps controls and inspector placement predictable without changing drawing, editing, or geometry behaviour</li>
                <li>Settings and reset dialogs now render above the full editor surface reliably after being portaled out of the toolbar stacking context</li>
                <li>Short-height mobile landscape screens now keep the canvas primary by compacting toolbar chrome and moving the inspector into a proportionate side column</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Unified inspector spacing, section headers, and visual rhythm so empty and selected states feel like one system</li>
                <li>Tightened settings dialog grouping and spacing so appearance, dimensions, and export preferences read as a coherent product surface</li>
                <li>Improved empty inspector readability in light mode while preserving the restrained monochrome look</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.25.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-19</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Forgiving local loop closure now commits only the intended closed orthogonal room and discards dangling path segments outside the committed loop</li>
                <li>Local loop closure now handles exact vertex closure, endpoint-on-segment closure, and segment-crossing closure conservatively when a single valid ring is formed</li>
                <li>Rectangular wall and corner resize preview now tracks snapped drag updates more directly, reducing laggy or chasing motion during resize</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Dimensions
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Restored live draw-time wall length feedback for open orthogonal chains</li>
                <li>Room area beneath the room label now obeys the dimensions visibility setting consistently in the live editor and export path</li>
                <li>Holding Alt or Option now reliably inverts the dimensions visibility setting while held and restores the configured state immediately on release</li>
                <li>Selected rooms now show contextual wall dimensions when dimensions are visible, including non-rectangular orthogonal rooms, while selected walls continue to show a focused single-wall measurement</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Selected-room dimension overlays now derive labels from ordered orthogonal polygon edges rather than rectangle-only assumptions where needed</li>
                <li>Dimension visibility and contextual measurement overlays now align more closely with the intended low-clutter design-instrument feel</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.24.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-18</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added support for drawing orthogonal non-rectangular room shapes such as L-shapes and stepped rooms</li>
                <li>Added Backspace step-back while drafting so room shapes can be corrected incrementally before completion</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Room drawing now closes explicitly by clicking the starting point rather than assuming rectangle completion</li>
                <li>The active tail segment can be adjusted while drafting, making orthogonal shape construction more precise</li>
                <li>Valid local loops now auto-complete during drawing when they form a safe closed orthogonal room</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Refactored room geometry helpers to validate orthogonal simple polygons more directly</li>
                <li>Rectangle-only wall affordances are now gated away from non-rectangular rooms to avoid misleading edit UI</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.23.1</h2>
            <span className="text-sm text-muted-foreground">2026-03-18</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added a minimal SEO baseline with homepage title, description, Open Graph, and Twitter metadata</li>
                <li>Added install-surface metadata via the app manifest and verified file-based favicon, icon, apple icon, and Open Graph image routes</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.23.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-18</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added a minimal public homepage at `/` with clear product framing and a direct path into the editor</li>
                <li>Introduced a restrained Safari-style hero mockup using a real editor screenshot for stronger product credibility</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Homepage messaging now prioritises immediate editor starts with a single primary CTA and low-friction reassurance copy</li>
                <li>The hero now flows vertically from copy into the product screenshot, with calmer spacing and clearer visual hierarchy across desktop and mobile</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Updated the public-facing navigation and homepage metadata to better match the new market-layer entry point</li>
                <li>Refined the hero screenshot presentation, headline breaks, responsive title sizing, and cache-busting for homepage image updates</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.22.2</h2>
            <span className="text-sm text-muted-foreground">2026-03-17</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added a subtle PREVIEW badge to the top navigation to communicate product stage</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Clarifies product state for users arriving via the live domain</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.22.1</h2>
            <span className="text-sm text-muted-foreground">2026-03-16</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added wall-level selection as the first step toward richer geometry editing</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Wall selection is now available within a selected room</li>
                <li>Shared walls are correctly disambiguated based on which room side the pointer is on</li>
                <li>Wall hover and selection visuals use a clear amber highlight</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Wall hover now only appears when a room is selected, keeping the canvas visually calm</li>
                <li>Unselected state prioritises drawing behaviour, preventing wall selection from intercepting drawing actions</li>
                <li>Shared-wall hover and selection overlays render above room geometry for correct visibility</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.22.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-16</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added progressive low-zoom decluttering for rooms and editing chrome</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Very small rooms now hide label pills and use room-body selection as a fallback</li>
                <li>Small rooms hide resize handles before hiding more essential selection visibility</li>
                <li>Room area text now appears only when the room is large enough on screen to support it cleanly</li>
                <li>Selected rooms remain visibly selected even when low-zoom decluttering is active</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Large zoomed-out layouts are now calmer and easier to read</li>
                <li>Editing chrome is reduced when it becomes too small to be useful</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.21.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-16</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Fit View now works more reliably for larger drawings</li>
                <li>Zoom-out limits now adapt to the size of the current drawing</li>
                <li>
                  Larger layouts can zoom out farther without making small layouts feel lost in
                  empty space
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Small or empty drawings retain a comfortable zoom floor</li>
                <li>Larger drawings can lower the effective minimum zoom when needed</li>
                <li>Manual zoom and Fit View now use compatible drawing-aware zoom bounds</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.20.1</h2>
            <span className="text-sm text-muted-foreground">2026-03-16</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Improved editor toolbar layout on small screens</li>
                <li>Moved the export signature field into Editor Settings under Export</li>
                <li>Kept key toolbar actions reachable on mobile with simplified icon-first controls</li>
                <li>Reduced mobile toolbar width pressure by removing the inline signature field</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Settings is now reachable on small screens</li>
                <li>Export signature is now configured from Editor Settings rather than directly in the toolbar</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.20.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-16</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added a measurement font size setting in Editor Settings</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Measurement text can now be shown in Normal or Large size</li>
                <li>The setting affects:</li>
                <li>room area beneath the room label pill</li>
                <li>draw-time dimension overlays</li>
                <li>resize-time dimension overlays</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Measurement text scaling now adjusts related spacing and offsets to keep overlays balanced</li>
                <li>Settings controls now stack more cleanly on mobile and expand appropriately in the drawer</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.19.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-16</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Hold <strong>Alt/Option</strong> to temporarily invert the dimensions visibility setting</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Dimensions visibility can now be temporarily revealed or hidden during drawing and resizing</li>
                <li>Added inline discoverability hint in Editor Settings for the temporary override</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Temporary override affects draw-time segment dimensions</li>
                <li>Temporary override affects draw-time width/height previews</li>
                <li>Temporary override affects wall resize dimensions</li>
                <li>Temporary override affects corner resize dimensions</li>
                <li>Room area beneath the room label pill remains visible</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.18.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-16</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added a dimensions visibility setting in Editor Settings</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Behaviour
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Dimensions visibility now controls measurement overlays during room drawing</li>
                <li>Dimensions visibility now controls measurement overlays during wall resizing</li>
                <li>Dimensions visibility now controls measurement overlays during corner resizing</li>
                <li>
                  Room area beneath the room label pill remains visible regardless of the
                  dimensions visibility setting
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Measurement overlay visibility is now centrally controlled through editor settings</li>
                <li>
                  Separation clarified between persistent room label metadata and temporary
                  measurement overlays
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.17.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-16</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">New</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Editor settings foundation introduced</li>
                <li>Settings button added to the editor toolbar</li>
                <li>Responsive settings surface with a dialog on desktop and a drawer on mobile</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Global button press feedback now uses a subtle 0.97 press scale</li>
                <li>Disabled buttons now show a <code>not-allowed</code> cursor</li>
                <li>Improved accessibility for editor dialogs</li>
                <li>Introduced a responsive dialog wrapper for future settings and help surfaces</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Architecture
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added an editor settings model to the Zustand store</li>
                <li>Integrated settings persistence with the editor snapshot system</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.16.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-14</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Live wall dimensions
              </h3>
              <p className="mt-2">
                Wall dimensions now appear during drawing and resize, giving clear live
                measurement feedback without cluttering the canvas.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added metric wall dimension calculation and formatting helpers</li>
                <li>Displayed live width and height dimensions while drawing rooms</li>
                <li>Displayed one live dimension during edge resize</li>
                <li>Displayed two live dimensions during corner resize</li>
                <li>Updated dimensions continuously from preview geometry before commit</li>
                <li>Matched dimension styling to the SpaceForge measurement system</li>
                <li>
                  Polished placement, consistency, and readability across active drawing and
                  resize interactions
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.15.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-14</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Room area display
              </h3>
              <p className="mt-2">
                Rooms now display their calculated floor area directly on the canvas, making
                SpaceForge more useful for quick planning and sketching.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added metric room area calculation and formatting</li>
                <li>Introduced JetBrains Mono for measurement-style text</li>
                <li>Displayed room area beneath the room name in canvas labels</li>
                <li>Hid area text automatically on very small rooms to avoid clutter</li>
                <li>Polished two-line label layout and measurement readability</li>
                <li>Updated room area live during resize</li>
                <li>Added subtle live emphasis for area feedback during active resize</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.14.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-14</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Reset camera
              </h3>
              <p className="mt-2">
                Added a reset-camera action that reframes the canvas around the current layout,
                making it easy to get back to a sensible view.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added reset-camera / fit-to-rooms action</li>
                <li>Framed all rooms using shared outer bounds with comfortable padding</li>
                <li>Added a smooth animated camera transition</li>
                <li>Made reset-camera interruption-safe during manual pan and zoom</li>
                <li>Added a toolbar control for quick access</li>
                <li>Improved no-rooms behaviour and reset-camera robustness</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.13.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-14</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Room deletion
              </h3>
              <p className="mt-2">
                The editor now supports deleting the selected room, completing the basic
                room-edit loop.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Added delete action for the selected room</li>
                <li>Added keyboard deletion with Delete and Backspace</li>
                <li>Prevented accidental deletion while typing in editable fields</li>
                <li>Integrated delete with undo/redo and persisted history</li>
                <li>Polished delete affordance in the selected-room panel</li>
                <li>Cleaned up focus and panel state after delete, undo, and redo</li>
              </ul>
            </div>
          </div>
        </section>

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
