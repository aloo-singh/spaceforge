export default function AdminChangelogPage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Admin changelog</h1>

        <p className="mt-4 text-sm leading-relaxed text-foreground/80">
          What changed in each SpaceForge milestone.
        </p>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.67.0</h2>
            <span className="text-sm text-muted-foreground">2026-04-29</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added / Improved</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Openings (doors/windows) now fully support copy, cut, paste, duplicate, and mirror-duplicate</li>
                <li>Right-click context menu in sidebar with platform-aware keycaps</li>
                <li>Mirror duplicate via keyboard (Cmd+Opt+D / Ctrl+Alt+D) and context menu</li>
                <li>Improved resize anchoring (dragged handle by default, Alt/Option for center)</li>
                <li>Meaningful, consistent Sonner messages and undo/redo labels for all opening actions</li>
                <li>Smart placement and bounds safety when pasting/duplicating</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.66.0</h2>
            <span className="text-sm text-muted-foreground">2026-04-28</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Added</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Complete interior asset framework (Bed, Sofa, Wardrobe, Dining Table)</li>
                <li>Distinct 2D visuals, labels, resize/rotate/name/delete support</li>
                <li>New Assets panel/drawer for easy placement (desktop popover + mobile Vaul)</li>
                <li>Full copy/cut/paste/duplicate with smart naming and bounds safety</li>
                <li>Type-specific inspector controls (wardrobe doors, dining table shape)</li>
                <li>Regionalisation foundation (metric/imperial + size presets)</li>
                <li>Meaningful undo/redo labels and batch operations</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">v0.65.0</h2>
            <span className="text-sm text-muted-foreground">2026-04-27</span>
          </div>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/90">
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground/95">Dev Subscription Tiers</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>Local-only dev mode gated by <code className="bg-muted px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_DEV_SUBSCRIPTION_MODE</code></li>
                <li>Tier selector in header nav (Free, Pro, Studio, Education)</li>
                <li>Tier selection persists across refreshes</li>
                <li>Central subscription tiers and features config (<code className="bg-muted px-1.5 py-0.5 rounded text-xs">tiers.ts</code> + <code className="bg-muted px-1.5 py-0.5 rounded text-xs">features.ts</code>)</li>
                <li>Updated floor limits (Free=1, Pro=3, Studio=6, Education=6)</li>
                <li>Calm, benefit-focused upsell dialog for tier limits</li>
                <li>Gating logic now respects dev tier when enabled</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
