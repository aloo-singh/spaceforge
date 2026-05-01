import { FeaturesPageActions } from "@/components/admin/FeaturesPageActions";
import { FeaturesTable } from "@/components/admin/FeaturesTable";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminFeaturesPage() {
  return (
    <div className="w-full space-y-4">
      <Card className="w-full border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <p className="font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/45 uppercase">
              Feature Gates
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Subscription feature limits by tier
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Read-only view of all gated features and their per-tier limits. This automatically
              reflects the central feature configuration in{" "}
              <code className="rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground/80">
                SUBSCRIPTION_FEATURES
              </code>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full border-border/70 bg-card/95 shadow-sm">
        <CardContent className="p-6">
          <FeaturesPageActions />
        </CardContent>
      </Card>

      <Card className="w-full border-border/70 bg-background/90 shadow-sm">
        <CardContent className="p-0">
          <FeaturesTable />
        </CardContent>
      </Card>
    </div>
  );
}
