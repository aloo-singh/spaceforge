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
            <h2 className="text-2xl font-semibold">v0.49.3</h2>
            <span className="text-sm text-muted-foreground">2026-03-27</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>New setting in Editor Settings: &ldquo;Wall measurements&rdquo; (Inside walls / Outside walls)</li>
                <li>Default: Inside walls</li>
                <li>Session-wide persistence</li>
                <li>Applies consistently to all room types</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.49.2</h2>
            <span className="text-sm text-muted-foreground">2026-03-27</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Fixed (Geometry Hardening)
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  Handle priority: selected window/opening resize handles now correctly take
                  precedence over nearby room corners
                </li>
                <li>Dragging the intended handle feels logical and predictable</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.49.1</h2>
            <span className="text-sm text-muted-foreground">2026-03-26</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improved (Analytics Drop-off)
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Refined &quot;Drop-off before first room&quot; card wording to &quot;No canvas interaction&quot;</li>
                <li>Added clear breakdown cards showing what those sessions actually did</li>
                <li>Subtle red accent when drop-off rate is high</li>
                <li>Detail page now provides immediate insight</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.48.1</h2>
            <span className="text-sm text-muted-foreground">2026-03-26</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improved (Analytics Polish)
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Sparkline in Feedback Inbox is now truly tiny and subtle</li>
                <li>Restored compact feedback trend chart on the main analytics dashboard</li>
                <li>Fixed tooltip text contrast and vertical hover line visibility in dark mode</li>
                <li>Minor layout/spacing refinements across dashboard and detail pages</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.47.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-26</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Added (Analytics Detail Pages)
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Clickable metric cards on the main analytics dashboard</li>
                <li>Dedicated detail pages for sessions per day with a daily line chart</li>
                <li>Dedicated detail pages for % drawing at least one room with a trend chart</li>
                <li>Dedicated detail pages for average time to first room</li>
                <li>Dedicated detail pages for total rooms created with cumulative growth</li>
                <li>Consistent back navigation and larger charts using shadcn components</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.46.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-26</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Analytics dashboard foundation in <code>/admin/analytics</code></li>
                <li>
                  Key metric cards: sessions per day, % drawing at least one room, average time to
                  first room, total rooms created
                </li>
                <li>Basic feedback submissions trend line chart over last 30 days</li>
                <li>Clean integration with the new shadcn sidebar</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.45.4</h2>
            <span className="text-sm text-muted-foreground">2026-03-26</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  Unread count badge on Feedback Inbox sidebar now uses red destructive accent for
                  better visibility when there is new feedback
                </li>
                <li>Badge remains small, calm, and hidden when count is zero</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.45.3</h2>
            <span className="text-sm text-muted-foreground">2026-03-26</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improved (Feedback Inbox Timing Polish)
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  &quot;Last updated&quot; now shows friendly relative time (&quot;just now&quot;,
                  &quot;5 minutes ago&quot;, &quot;2 hours ago&quot;) with light auto-refresh
                </li>
                <li>
                  Timing column uses compact format: &quot;57s&quot;, &quot;3m 18s&quot;,
                  &quot;1h 12m&quot; (smallest populated unit only)
                </li>
                <li>Both use consistent measurement typography</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.45.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-26</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Added (Feedback Inbox Phase 2)
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Mark individual feedback items as read</li>
                <li>&quot;Mark all as read&quot; button</li>
                <li>Unread count badge on the sidebar nav item</li>
                <li>Simple All / Unread filter (defaults to Unread)</li>
                <li>Subtle visual distinction for unread rows</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.44.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-26</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Upgraded admin area to the full shadcn sidebar block</li>
                <li>Added proper collapsible behaviour on desktop</li>
                <li>Cleaner navigation layout with consistent spacing and icons</li>
                <li>Better mobile responsiveness while preserving the existing drawer behaviour</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.43.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-25</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Live preview inside the Export PNG dialog</li>
                <li>Desktop: split layout (live preview on left, settings on right)</li>
                <li>Mobile: stacked preview above settings</li>
                <li>Preview updates in real time (throttled) as any setting changes</li>
                <li>Export button remains fixed at the bottom</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.42.2</h2>
            <span className="text-sm text-muted-foreground">2026-03-25</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improved (Export Dialog Polish)
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Export button now stays fixed at the bottom while settings scroll</li>
                <li>
                  Last-used toggles (grid, dimensions, legend, scale bar, theme) are remembered
                  for the session
                </li>
                <li>Title and description are now saved per-project</li>
                <li>Minor spacing and layout refinements for a calmer dialog</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.42.1</h2>
            <span className="text-sm text-muted-foreground">2026-03-25</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improved (Export Phase 2 Polish)
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Larger, more prominent title and description in exported PNG</li>
                <li>Cleaner legend layout with JetBrains Mono for areas</li>
                <li>
                  New &quot;Show scale bar&quot; toggle (defaults to Off, reuses canvas scale style)
                </li>
                <li>Tighter spacing and calmer labels inside the Export dialog</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.42.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-25</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added (Export Phase 2)</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Title and description fields in Export PNG dialog</li>
                <li>&quot;Show legend&quot; toggle (simple room list with names + areas)</li>
                <li>&quot;Designed by&quot; field (pre-filled from export signature setting)</li>
                <li>All new elements render correctly in the exported PNG</li>
                <li>Extended existing PixiJS export path (no parallel systems)</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.41.1</h2>
            <span className="text-sm text-muted-foreground">2026-03-25</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Feedback Inbox polish: better date formatting, tighter table spacing, subtle row hover</li>
                <li>Click-to-expand free text rows</li>
                <li>Proper empty state using the new shadcn Empty component</li>
                <li>Calmer, more accessible sentiment badges</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.41.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-25</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Feedback Inbox inside the protected admin area</li>
                <li>
                  Real-time list of all <code>feedback_submissions</code> with columns for date,
                  sentiment, page, source, free text, and timing
                </li>
                <li>Clear green/red sentiment badges for positive/negative feedback at a glance</li>
                <li>Server-side fetch with proper sorting (newest first)</li>
                <li>Shared table primitive for consistent future admin tables</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.40.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-25</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Protected <code>/admin</code> route group with sidebar shell</li>
                <li>Simple admin login page at <code>/admin/login</code></li>
                <li>Logout link inside admin shell</li>
                <li>Server-side protection via <code>ADMIN_EMAILS</code> environment variable</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.39.1</h2>
            <span className="text-sm text-muted-foreground">2026-03-25</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Fixed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>First-resize visual glitch on newly created rectangular rooms (diagonal stretch/distortion on initial drag)</li>
                <li>Rectangular resize now correctly preserves the room&apos;s existing corner ordering</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.39.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-24</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Export PNG dialog with toggles for grid, dimensions, and export theme (Light / Dark / System)</li>
                <li>Subtle &quot;Designed with [s]paceforge&quot; signature in exported images</li>
                <li>Responsive dialog (desktop) / drawer (mobile) using shared primitives</li>
                <li>Final polish to keep Export theme subtitle on a single line</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.38.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-24</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Visible keyboard shortcut keycaps for feedback actions</li>
                <li>
                  Keyboard submission support for feedback:
                  macOS: <code>Cmd+Enter</code>, Windows/Linux: <code>Ctrl+Enter</code>
                </li>
                <li>Keyboard back and close support in the feedback flow using <code>Esc</code></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Feedback text step now auto-focuses the input</li>
                <li>Send shortcut presentation now uses a compact keycap style consistent with other product shortcuts</li>
                <li>Send button layout is tighter and more balanced</li>
                <li>Feedback flow feels cleaner and more intentional on desktop and mobile</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Fixed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Mobile feedback drawer no longer loses input focus while typing</li>
                <li>Mobile drawer width and inset behaviour improved so content no longer hangs off the right edge</li>
                <li>Shared mobile drawer path is now more consistent across feedback and delete confirmation flows</li>
                <li>First-project bootstrap race fixed so duplicate initial projects are no longer created</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>This release closes out the current feedback-system workstream</li>
                <li>A small remaining mobile drawer open-animation polish issue is tracked separately for later refinement</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.37.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-24</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Fixed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Resolved intermittent duplicate first-project creation during bootstrap</li>
                <li>Fixed mobile feedback input losing focus while typing</li>
                <li>Fixed mobile drawer width overflow so controls no longer hang off the right edge</li>
                <li>Improved shared mobile drawer safe-area padding and horizontal inset behaviour</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Reworked shared mobile drawer behaviour so feedback and delete confirmation use the same drawer path</li>
                <li>Mobile drawers now slide in and out more reliably and consistently</li>
                <li>Shared mobile drawer sizing now behaves better across short and tall content</li>
                <li>Desktop dialog behaviour remained unchanged while mobile behaviour was stabilised</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Changed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>First-project bootstrap now goes through a single guarded path</li>
                <li>Shared mobile dialog and drawer routing is now more consistent across features</li>
                <li>Feedback and delete confirmation both rely on the shared mobile drawer primitive</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>This release focuses on trust, stability, and shared primitive consistency</li>
                <li>A small remaining polish item is still noted for later: mobile drawer content-fit tuning and keycap affordances</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.36.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-23</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Fixed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Prevented duplicate first-project creation during initial bootstrap</li>
                <li>Coordinated competing first-project creation paths across <code>/editor</code> and <code>/projects</code></li>
                <li>Stabilised active project resolution immediately after first project creation</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>First-project bootstrap now uses one canonical guarded path</li>
                <li>Competing first-project creation attempts now reuse in-flight work or wait and re-check instead of creating again</li>
                <li>Refreshes and overlapping entry flows are handled more safely during initial project creation</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Existing users with projects continue to follow normal open/create flows</li>
                <li>Homepage and returning-user routing behaviour remain unchanged</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.35.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-23</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Permanent feedback button on both <code>/editor</code> and <code>/projects</code></li>
                <li>Shared two-step feedback flow for both manual entry and prompted feedback</li>
                <li>Feedback persistence through Supabase with page context, source, sentiment, free text, timing, and metadata</li>
                <li>First responsive mobile drawer system for feedback and shared dialog surfaces</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Changed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Projects delete confirmation and editor reset confirmation now use shared shadcn-aligned dialog primitives</li>
                <li>Editor settings and feedback mobile presentation now route through shared responsive dialog infrastructure</li>
                <li>Mobile drawers now use a calmer bottom-sheet motion pattern instead of ad hoc per-surface behavior</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Feedback flow feels more human and less survey-like, with calmer spacing, submit feedback, and a clearer thank-you state</li>
                <li>Auto-prompt and manual feedback entry now feel more distinct on desktop while still sharing the same question flow</li>
                <li>Button press behavior and drawer interaction now align more closely with the rest of the product interaction language</li>
                <li>Mobile dialog and drawer accessibility wiring is now consistent across feedback, settings, and destructive confirms</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Prompted feedback is session-scoped and avoids repeated re-showing after dismissal or submission</li>
                <li>No admin UI, feedback inbox, or AI summarisation has been added yet</li>
                <li>This release establishes the first complete feedback capture loop while also standardising shared dialog foundations for later work</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.34.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-23</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Visual thumbnails for projects on the <code>/projects</code> page</li>
                <li>Automatic thumbnail generation from the canvas</li>
                <li>Lightweight thumbnail storage on each project</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Projects page now shows visual previews instead of text-only cards</li>
                <li>Easier recognition and recall of projects</li>
                <li>Projects page feels more alive and personal</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Changed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Thumbnails are generated after meaningful document changes</li>
                <li>Thumbnail updates are debounced and run off the main interaction path</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Thumbnails reuse the existing export rendering pipeline</li>
                <li>Fallback placeholder is shown for empty or missing thumbnails</li>
                <li>No external storage introduced at this stage</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.33.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-23</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Intelligent entry routing on <code>/</code> for returning users</li>
                <li>Lightweight project presence check for existing anonymous identities</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Changed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Returning users with projects now skip the homepage and go straight to <code>/projects</code></li>
                <li>First-time users and users with no projects still see the homepage as normal</li>
                <li>Homepage no longer creates anonymous identity just by being visited</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>App now feels more like a workspace for returning users</li>
                <li>Preserved homepage value for first-time visitors while reducing friction for existing users</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Direct routes remain unchanged</li>
                <li>Routing fails safely back to the homepage if presence checks fail</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.31.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-21</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Slowed onboarding hint pacing to feel calmer and more readable</li>
                <li>Added short pause after project rename so the moment can register</li>
                <li>Anchored the rename hint to the project name in the editor</li>
                <li>Improved visual connection between hint and target</li>
                <li>Made onboarding flow feel less rushed and more intentional</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Changed
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Increased dwell time for project ownership and naming hints</li>
                <li>Introduced explicit timing constants for easier tuning</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Hint system remains lightweight and non-blocking</li>
                <li>No full coachmark system introduced at this stage</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.30.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-21</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Explicit &ldquo;close the shape to make a room&rdquo; onboarding step</li>
                <li>Project ownership onboarding moment after first room creation</li>
                <li>Naming-focused onboarding moment encouraging project naming</li>
                <li>Curated default project names replacing &ldquo;Untitled project&rdquo;</li>
                <li>First project now defaults to &ldquo;My first layout&rdquo;</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Changed
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Onboarding sequence now prioritises accomplishment, ownership, naming, safety, and then tools</li>
                <li>Undo is introduced earlier as a safety signal</li>
                <li>Projects awareness is now integrated into naming guidance</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improved
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Onboarding copy is more human and less instructional</li>
                <li>First-use experience better communicates that work is saved automatically</li>
                <li>Project naming now feels more natural and intentional</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Removed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>&ldquo;Click the room name to select it&rdquo; onboarding step</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.29.0</h2>
            <span className="text-sm text-muted-foreground">2026-03-20</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Anonymous user identity system for persistent project storage</li>
                <li>Projects model with create, list, fetch, and update support</li>
                <li><code>/projects</code> page for browsing and opening saved work</li>
                <li>Multi-project support with automatic persistence</li>
                <li>Inline project renaming on the projects page</li>
                <li>Inline project renaming directly in the editor</li>
                <li>Background syncing of editor document to backend</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Changed
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Editor now loads and persists work per project instead of a single local canvas</li>
                <li>Project context is integrated into the editor top bar</li>
                <li>Navigation between editor and projects is now explicit and reversible</li>
                <li>Project list is sorted by most recently updated</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">
                Improvements
              </h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Removed redundant open actions on project cards</li>
                <li>Simplified projects page UI and removed confusing helper copy</li>
                <li>Streamlined project naming flow with inline editing</li>
                <li>Editor/project interaction now feels continuous and low-friction</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Fixed</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Restored missing editor controls after UI regression</li>
                <li>Removed invalid cursor state on project name</li>
                <li>Removed redundant navigation elements in editor</li>
                <li>Cleaned up duplicate divider lines in editor shell</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Existing local editor persistence remains intact as a fallback</li>
                <li>No account/auth system introduced yet (anonymous users only)</li>
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
