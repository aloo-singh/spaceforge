import { Card, CardContent } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/45 uppercase">
              Feedback Inbox
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Admin foundation is in place.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              This shell is intentionally minimal. Feedback triage and analytics surfaces can
              now layer into a protected internal route without touching the public product.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed border-border/70 bg-background/80 shadow-sm">
        <CardContent className="space-y-3 p-6">
          <p className="font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/45 uppercase">
            Next
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Phase 2 can attach the real feedback inbox here. Analytics remains intentionally
            disabled until the supporting views and queries are defined.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
