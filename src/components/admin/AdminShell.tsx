import Link from "next/link";
import { BarChart3, Inbox } from "lucide-react";

import { BrandWordmark } from "@/components/brand-wordmark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AdminShellProps = {
  userEmail: string;
  children: React.ReactNode;
};

const adminNavItems = [
  {
    href: "/admin",
    label: "Feedback Inbox",
    description: "Incoming product signals",
    icon: Inbox,
    isActive: true,
    isDisabled: false,
  },
  {
    href: "/admin",
    label: "Analytics",
    description: "Placeholder for Phase 2",
    icon: BarChart3,
    isActive: false,
    isDisabled: true,
  },
] as const;

export function AdminShell({ userEmail, children }: AdminShellProps) {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
        <aside className="w-full lg:max-w-xs">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="space-y-6 p-4">
              <div className="space-y-2">
                <p className="font-measurement text-[10px] font-semibold tracking-[0.18em] text-foreground/45 uppercase">
                  Admin
                </p>
                <BrandWordmark className="text-base" />
                <p className="text-sm leading-6 text-muted-foreground">
                  Calm, minimal workspace for internal review and operational tooling.
                </p>
              </div>

              <nav className="space-y-2" aria-label="Admin sections">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;

                  if (item.isDisabled) {
                    return (
                      <Button
                        key={item.label}
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-lg border border-transparent px-3 py-3 text-left"
                        disabled
                      >
                        <span className="flex items-start gap-3">
                          <Icon className="mt-0.5 size-4 text-muted-foreground" />
                          <span className="space-y-1">
                            <span className="block text-sm font-medium">{item.label}</span>
                            <span className="block text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </span>
                      </Button>
                    );
                  }

                  return (
                    <Button
                      key={item.label}
                      asChild
                      variant="secondary"
                      className="h-auto w-full justify-start rounded-lg border border-border/70 px-3 py-3 text-left shadow-none"
                    >
                      <Link href={item.href} aria-current={item.isActive ? "page" : undefined}>
                        <span className="flex items-start gap-3">
                          <Icon className="mt-0.5 size-4" />
                          <span className="space-y-1">
                            <span className="block text-sm font-medium">{item.label}</span>
                            <span className="block text-xs text-foreground/65">
                              {item.description}
                            </span>
                          </span>
                        </span>
                      </Link>
                    </Button>
                  );
                })}
              </nav>

              <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-3">
                <p className="font-measurement text-[10px] font-semibold tracking-[0.16em] text-foreground/45 uppercase">
                  Access
                </p>
                <p className="mt-2 break-all text-sm text-foreground/75">{userEmail}</p>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}
