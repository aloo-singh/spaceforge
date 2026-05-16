type ReleaseNote = {
  version: string;
  date: string;
  title: string;
  items: string[];
};

const latestHighlights: ReleaseNote[] = [
  {
    version: "v0.79.0",
    date: "2026-05-16",
    title: "Metric and imperial project support",
    items: [
      "New projects can now start in either Metric or Imperial, with a first-run choice and a clearer setting for changing the project region later.",
      "Plans keep their internal precision while showing measurements in the project’s chosen units, including room sizes, rulers, areas, and inspector dimensions.",
      "New rooms, openings, rulers, and furniture remember whether they began as metric or imperial, with calm inspector badges and an optional Pro highlight mode.",
      "This release also includes the recent kitchen and furniture polish: 5-burner hobs, clearer asset grouping, improved basin and bath details, and more legible appliance hatching.",
    ],
  },
  {
    version: "v0.78.14",
    date: "2026-05-14",
    title: "New Desk asset with attached chair",
    items: [
      "Add a desk to your floor plan from the Furniture panel—dimensions are 1200×900mm with a rectangular desktop and semicircle chair section.",
      "Resize the desktop width and depth to fit your space; the chair remains a fixed size and always extends from the correct edge.",
      "Desks rotate smoothly in all directions with geometry that rotates as a cohesive unit.",
    ],
  },
  {
    version: "v0.78.0",
    date: "2026-05-08",
    title: "Browse projects your way",
    items: [
      "The projects page now has a calm info toggle for showing project details directly over each thumbnail.",
      "You can filter projects by rooms and area, with floor filters available on paid tiers.",
      "Choose between small grid, large grid, and list views; your preferred layout is remembered for next time.",
    ],
  },
  {
    version: "v0.77.0",
    date: "2026-05-07",
    title: "Measure distances with the ruler tool",
    items: [
      "A new ruler tool lets you drop precise measurement lines anywhere on the canvas — click to set the start, click again to lock the end.",
      "Rulers snap to the grid and to room walls, constrain to horizontal, vertical, or 45° diagonals, and show live distance labels as you draw.",
      "Press R to toggle the ruler tool, rename rulers in the inspector, hide or delete individual ones, and undo every action with a friendly confirmation.",
    ],
  },
  {
    version: "v0.76.0",
    date: "2026-05-07",
    title: "Remove a corner in one click",
    items: [
      "Hovering a corner on a selected room now reveals a calm × handle offset along the outward diagonal — click it to remove the corner and merge its two walls.",
      "An L-shape becomes a rectangle in a single click; the canvas settles smoothly with the same animation used when splitting walls.",
      "The action is fully undoable with a friendly confirmation message such as \"Bedroom corner removed\".",
    ],
  },
  {
    version: "v0.75.0",
    date: "2026-05-06",
    title: "Split walls while you edit",
    items: [
      "Selected room walls now show a calm split handle, with a tooltip and cursor that make the action easier to find.",
      "Click the plus, Alt/Option-click a wall, or double-click a wall to split it and immediately shape the new corner.",
      "Wall splits now have clearer undo labels and friendly confirmations, including messages such as 'Bedroom wall split'.",
    ],
  },
  {
    version: "v0.74.0",
    date: "2026-05-06",
    title: "Focus on one room",
    items: [
      "The room inspector now has a calm eye toggle for focusing the canvas on the selected room.",
      "Focus mode hides other rooms while keeping the selected room, its openings, assets, and labels visible.",
      "Switch rooms or turn the toggle off to return instantly to the full plan.",
    ],
  },
  {
    version: "v0.73.0",
    date: "2026-05-06",
    title: "Export a single room",
    items: [
      "The export dialog now lets you choose exactly what to export: the current floor or one room.",
      "Single-room exports keep the preview, room labels, assets, openings, and export details in sync across PNG, SVG, and PDF.",
      "Exported filenames now include the floor and room name, so focused room files are easier to identify and share.",
    ],
  },
  {
    version: "v0.72.0",
    date: "2026-05-06",
    title: "Focus the canvas on one room",
    items: [
      "The toolbar now has separate controls for fitting every room or just the selected room into view.",
      "Press F to fit the full plan, or Shift+F to zoom neatly to a single selected room.",
      "The selected-room fit keeps the same smooth camera movement while using tighter framing for focused layout work.",
    ],
  },
  {
    version: "v0.71.15",
    date: "2026-05-06",
    title: "Smoother editing for openings, stairs, and selections",
    items: [
      "Moving several rooms, assets, or openings now feels more natural, with grouped moves and undo behaving as one clear step.",
      "Selected items are easier to follow on the canvas, including multi-select highlights, live opening distance guides, and more reliable resize cursors.",
      "Doors, windows, and stairs have had a round of precision fixes, including better floor-plan door symbols, steadier resizing, and linked stairs staying in sync between floors.",
    ],
  },
  {
    version: "v0.71.0",
    date: "2026-05-05",
    title: "Editable SVG and PDF exports",
    items: [
      "Export plans as SVG for editable vector work in tools like Illustrator and Inkscape.",
      "Create print-ready PDF exports for sharing with contractors, clients, and planning conversations.",
      "Vector exports now include rooms, openings, furniture, labels, scale bar, legend, north arrow, title, description, and designed-by footer.",
    ],
  },
  {
    version: "v0.70.0",
    date: "2026-05-01",
    title: "Hi-res exports for premium plans",
    items: [
      "Export plans in 4x resolution (5120px) for crisp, sharp prints and presentations at any size.",
      "Hi-res option is visible to all users but gated to Pro, Studio, and Education plans.",
      "Free users see a calm upgrade prompt with clear benefits—4x resolution means 16x total pixels for maximum crispness.",
    ],
  },
  {
    version: "v0.68.0",
    date: "2026-05-01",
    title: "Free tier project limits (with calm upsell)",
    items: [
      "Free tier is now limited to 2 projects; Pro, Studio, and Education tiers offer unlimited projects.",
      "When you reach your project limit, a calm, benefit-focused dialog and on-page banner invite you to upgrade.",
      "Creating a new project is still straightforward—the 'New project' button shows the upgrade option rather than disabling.",
    ],
  },
  {
    version: "v0.67.0",
    date: "2026-04-29",
    title: "Smarter door and window editing",
    items: [
      "Doors and windows can now be copied, pasted, duplicated, and mirrored much more quickly.",
      "Opening placement and resizing are more forgiving, with better bounds handling.",
      "Common opening actions now feel more consistent across the editor.",
    ],
  },
  {
    version: "v0.66.0",
    date: "2026-04-28",
    title: "Interior assets arrive",
    items: [
      "You can now add furniture-style assets such as beds, sofas, wardrobes, and tables.",
      "Assets support naming, moving, resizing, rotation, and duplication.",
      "The inspector now offers more tailored controls for different asset types.",
    ],
  },
  {
    version: "v0.65.0",
    date: "2026-04-27",
    title: "Clearer subscription plans and limits",
    items: [
      "Plan tiers are now clearer in the product, including Free, Pro, Studio, and Education.",
      "Project floor limits are now more clearly communicated by plan.",
      "Upgrade prompts are calmer and easier to understand when you hit a limit.",
    ],
  },
  {
    version: "v0.64.0",
    date: "2026-04-24",
    title: "Undo and redo are easier to scan",
    items: [
      "Undo and redo now expose a clearer history, so it is easier to jump back multiple steps.",
      "History entries use plainer language and are faster to scan.",
      "Batch actions now feel more predictable when stepping backward or forward.",
    ],
  },
  {
    version: "v0.63.0",
    date: "2026-04-23",
    title: "More reliable saving and recovery",
    items: [
      "Projects recover more reliably after a refresh or interrupted session.",
      "Undo and redo history now survives refreshes more consistently.",
      "Overall project persistence is safer and more trustworthy during active work.",
    ],
  },
  {
    version: "v0.62.0",
    date: "2026-04-22",
    title: "Easier multi-floor organisation",
    items: [
      "Floor organisation in the sidebar is clearer and easier to navigate.",
      "Adding floors above or below is more direct.",
      "Selected rooms and floors are easier to follow inside larger projects.",
    ],
  },
  {
    version: "v0.60.0",
    date: "2026-04-16",
    title: "Faster sidebar workflows",
    items: [
      "The sidebar now supports multi-select, duplicate, drag, and reorder workflows more smoothly.",
      "Moving content between rooms and floors is faster.",
      "Bulk actions now feel more consistent with the canvas.",
    ],
  },
  {
    version: "v0.59.0",
    date: "2026-04-13",
    title: "Multi-floor planning lands",
    items: [
      "Projects can now span multiple floors.",
      "Stairs can be linked between floors for clearer vertical planning.",
      "Floor switching, naming, and deletion are now built into the workflow.",
    ],
  },
  {
    version: "v0.58.0",
    date: "2026-04-12",
    title: "Diagonal walls and richer geometry",
    items: [
      "Rooms can now include 45-degree walls.",
      "Mixed orthogonal and diagonal layouts are easier to draw and edit.",
      "Doors and windows now behave properly on diagonal walls as well.",
    ],
  },
  {
    version: "v0.57.0",
    date: "2026-04-10",
    title: "A better mobile editor",
    items: [
      "The editor now adapts more cleanly to phones and smaller screens.",
      "Touch-friendly zoom, fit, and drawing controls are easier to reach.",
      "Mobile panels feel calmer and less crowded during active editing.",
    ],
  },
  {
    version: "v0.56.0",
    date: "2026-04-09",
    title: "Cleaner controls across the editor",
    items: [
      "Controls across the editor have been simplified and made more consistent.",
      "Shortcut feedback is clearer without getting in the way.",
      "Common editing actions now feel a bit lighter and faster.",
    ],
  },
  {
    version: "v0.54.0",
    date: "2026-04-07",
    title: "Better exported plans",
    items: [
      "PNG exports can now include a north indicator.",
      "Exported plans feel more presentation-ready.",
      "Export details are now better balanced across light and dark themes.",
    ],
  },
  {
    version: "v0.53.4",
    date: "2026-04-06",
    title: "Mini-map navigation",
    items: [
      "A new mini-map makes it easier to stay oriented in larger layouts.",
      "You can click and drag from the mini-map to pan the main canvas.",
      "The mini-map can be toggled on or off to suit your workspace.",
    ],
  },
  {
    version: "v0.53.2",
    date: "2026-04-02",
    title: "Interactive north indicator",
    items: [
      "North can now be adjusted directly on the canvas.",
      "The indicator is easier to read and more natural to use.",
      "North settings now feel like part of the normal layout workflow.",
    ],
  },
  {
    version: "v0.53.0",
    date: "2026-04-01",
    title: "A stronger editor sidebar",
    items: [
      "The left sidebar now gives projects a clearer structure.",
      "Rooms, walls, openings, and interior items are easier to browse and select.",
      "Selection now stays better aligned between sidebar, canvas, and inspector.",
    ],
  },
  {
    version: "v0.52.0",
    date: "2026-03-31",
    title: "Smarter snapping and guidelines",
    items: [
      "Guidelines now help you line up rooms and walls more confidently.",
      "Snapping is easier to understand and control.",
      "Drawing and editing feel more precise without adding clutter.",
    ],
  },
  {
    version: "v0.51.0",
    date: "2026-03-30",
    title: "Stairs enter the editor",
    items: [
      "You can now place stairs inside a room and edit them directly.",
      "Stairs can be moved and resized while staying inside room bounds.",
      "They now behave like a first-class part of your layout.",
    ],
  },
];

const earlierMilestones: ReleaseNote[] = [
  {
    version: "v0.43.0",
    date: "2026-03-25",
    title: "Live export preview",
    items: [
      "Exports now show a live preview before you download them.",
      "Settings and preview work together more smoothly on desktop and mobile.",
      "Sharing plans became much easier as export controls matured.",
    ],
  },
  {
    version: "v0.34.0",
    date: "2026-03-23",
    title: "Project thumbnails",
    items: [
      "Projects now show visual thumbnails on the projects page.",
      "It is much easier to recognise the layout you want to reopen.",
      "The projects view feels more useful at a glance.",
    ],
  },
  {
    version: "v0.29.0",
    date: "2026-03-20",
    title: "A real multi-project workspace",
    items: [
      "SpaceForge moved from a single saved layout to multiple projects.",
      "Projects can be named, reopened, and kept separate.",
      "The editor and projects page now work together like one workspace.",
    ],
  },
  {
    version: "v0.27.0",
    date: "2026-03-19",
    title: "Doors and windows arrive",
    items: [
      "Walls can now hold doors and windows as editable openings.",
      "Openings stay attached to their walls while moving and resizing.",
      "This was the start of a much richer plan-editing workflow.",
    ],
  },
  {
    version: "v0.26.0",
    date: "2026-03-19",
    title: "The editor layout takes shape",
    items: [
      "The editor gained a clearer structure with a top bar, canvas, and inspector.",
      "Settings became easier to reach and manage.",
      "The overall editing experience became more predictable.",
    ],
  },
  {
    version: "v0.24.0",
    date: "2026-03-18",
    title: "Beyond rectangles",
    items: [
      "Rooms can now be drawn as L-shapes and other orthogonal custom shapes.",
      "Drawing became more flexible without losing precision.",
      "This opened the door to more realistic floor plans.",
    ],
  },
  {
    version: "v0.15.0",
    date: "2026-03-14",
    title: "Measurements become more useful",
    items: [
      "Room area now appears directly on the canvas.",
      "Measurements became easier to read while editing.",
      "Plans started to feel more informative, not just drawable.",
    ],
  },
  {
    version: "v0.12.0",
    date: "2026-03-14",
    title: "Undo history you can trust",
    items: [
      "Undo and redo history now survives refreshes.",
      "Editing feels safer because your recent work is less fragile.",
      "This was a major reliability step for day-to-day use.",
    ],
  },
  {
    version: "v0.6.0",
    date: "2026-03-11",
    title: "Autosave and restore",
    items: [
      "Layouts started saving automatically in the browser.",
      "Refreshing the page could bring your work back.",
      "This turned the editor into something you could use with more confidence.",
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-03-09",
    title: "The first room-drawing tools",
    items: [
      "This was the first version where you could draw a room on the canvas.",
      "Pan, zoom, snapping, and the basic editing foundation all started here.",
      "Everything since has built on this core interaction model.",
    ],
  },
];

function ReleaseCard({ release }: { release: ReleaseNote }) {
  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{release.version}</h2>
          <p className="mt-1 text-sm font-medium text-foreground/90">{release.title}</p>
        </div>

        <span className="text-sm text-muted-foreground">{release.date}</span>
      </div>

      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
        {release.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function ChangelogPage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-background px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Changelog</h1>

        <p className="mt-4 text-sm leading-relaxed text-foreground/80">
          Customer-facing updates to SpaceForge. Internal, admin-only, and developer-only changes
          are intentionally left out.
        </p>

        {latestHighlights.map((release) => (
          <ReleaseCard key={release.version} release={release} />
        ))}

        <div className="mt-14 border-t border-border pt-10">
          <h2 className="text-xl font-semibold tracking-tight">Earlier milestones</h2>

          <p className="mt-2 text-sm leading-relaxed text-foreground/75">
            Selected highlights from the earlier product foundation.
          </p>

          {earlierMilestones.map((release) => (
            <ReleaseCard key={release.version} release={release} />
          ))}
        </div>
      </div>
    </main>
  );
}
