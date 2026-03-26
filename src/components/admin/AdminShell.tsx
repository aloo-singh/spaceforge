"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronRight, Inbox, LogOut, Mail } from "lucide-react";

import { logoutAdminAction } from "@/app/admin/actions";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type AdminShellProps = {
  userEmail: string;
  unreadFeedbackCount: number;
  children: React.ReactNode;
};

const adminNavItems = [
  {
    href: "/admin",
    label: "Feedback Inbox",
    description: "Incoming product signals",
    icon: Inbox,
  },
] as const;

const analyticsNavItems = [
  {
    href: "/admin/analytics",
    label: "Overview",
  },
  {
    href: "/admin/analytics/sessions-per-day",
    label: "Sessions per day",
  },
  {
    href: "/admin/analytics/drawing-at-least-one-room",
    label: "% drawing at least one room",
  },
  {
    href: "/admin/analytics/drop-off-before-first-room",
    label: "No canvas interaction",
  },
  {
    href: "/admin/analytics/average-time-to-first-room",
    label: "Average time to first room",
  },
  {
    href: "/admin/analytics/total-rooms-created",
    label: "Total rooms created",
  },
] as const;

export function AdminShell({ userEmail, unreadFeedbackCount, children }: AdminShellProps) {
  const pathname = usePathname();
  const isAnalyticsSectionActive = pathname.startsWith("/admin/analytics");
  const [isAnalyticsOpen, setIsAnalyticsOpen] = React.useState(isAnalyticsSectionActive);

  React.useEffect(() => {
    if (isAnalyticsSectionActive) {
      setIsAnalyticsOpen(true);
    }
  }, [isAnalyticsSectionActive]);

  return (
    <SidebarProvider>
      <main className="min-h-[calc(100vh-3.5rem)] flex-1 bg-muted/20">
        <div className="flex w-full gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8">
          <Sidebar collapsible="icon" className="shrink-0">
            <SidebarHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <SidebarGroupLabel>Admin</SidebarGroupLabel>
                  <div className="group-data-[state=collapsed]/sidebar:hidden">
                    <BrandWordmark className="text-base text-sidebar-foreground" />
                  </div>
                  <div className="hidden group-data-[state=collapsed]/sidebar:block">
                    <span className="font-measurement text-base leading-none font-semibold tracking-tight text-sidebar-foreground">
                      [s]
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-sidebar-foreground/70 group-data-[state=collapsed]/sidebar:hidden">
                    Calm, minimal workspace for internal review and operational tooling.
                  </p>
                </div>
                <SidebarTrigger className="shrink-0" />
              </div>
            </SidebarHeader>

            <SidebarContent className="flex-none overflow-visible">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu aria-label="Admin sections">
                    {adminNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;

                      return (
                        <SidebarMenuItem key={item.label}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            title={item.label}
                            className="shadow-none"
                          >
                            <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                              <Icon className="mt-0.5 size-4 shrink-0" />
                              <span className="min-w-0 space-y-1 group-data-[state=collapsed]/sidebar:hidden">
                                <span className="flex items-center gap-2">
                                  <span className="block text-sm font-medium">{item.label}</span>
                                  {item.label === "Feedback Inbox" && unreadFeedbackCount > 0 ? (
                                    <Badge
                                      variant="destructive"
                                      className="min-w-6 justify-center px-1.5 py-0 text-[10px] leading-4"
                                    >
                                      {unreadFeedbackCount}
                                    </Badge>
                                  ) : null}
                                </span>
                                <span className="block text-xs text-sidebar-foreground/65">
                                  {item.description}
                                </span>
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}

                    <SidebarMenuItem>
                      <Collapsible.Root open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
                        <Collapsible.Trigger asChild>
                          <SidebarMenuButton
                            isActive={isAnalyticsSectionActive}
                            title="Analytics"
                            className="shadow-none"
                          >
                            <BarChart3 className="mt-0.5 size-4 shrink-0" />
                            <span className="min-w-0 space-y-1 group-data-[state=collapsed]/sidebar:hidden">
                              <span className="flex items-center justify-between gap-3">
                                <span className="block text-sm font-medium">Analytics</span>
                                <ChevronRight
                                  className="size-4 shrink-0 text-sidebar-foreground/45 transition-transform data-[state=open]:rotate-90"
                                  data-state={isAnalyticsOpen ? "open" : "closed"}
                                />
                              </span>
                              <span className="block text-xs text-sidebar-foreground/65">
                                Core product telemetry
                              </span>
                            </span>
                          </SidebarMenuButton>
                        </Collapsible.Trigger>

                        <Collapsible.Content>
                          <SidebarMenuSub>
                            {analyticsNavItems.map((item) => {
                              const isActive = pathname === item.href;

                              return (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton asChild isActive={isActive}>
                                    <Link
                                      href={item.href}
                                      aria-current={isActive ? "page" : undefined}
                                    >
                                      {item.label}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
              <div className="rounded-2xl border border-sidebar-border/70 bg-background/70 px-3 py-3">
                <SidebarGroupLabel className="opacity-100 group-data-[state=collapsed]/sidebar:opacity-0">
                  Access
                </SidebarGroupLabel>
                <div className="mt-2 flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 shrink-0 text-sidebar-foreground/55" />
                  <p
                    className="min-w-0 break-all text-sm text-foreground/75 group-data-[state=collapsed]/sidebar:hidden"
                    title={userEmail}
                  >
                    {userEmail}
                  </p>
                </div>
                <form action={logoutAdminAction} className="mt-3">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    title="Log out"
                    className="h-8 w-full justify-start gap-2 px-0 text-foreground/65 hover:bg-transparent hover:text-foreground group-data-[state=collapsed]/sidebar:justify-center"
                  >
                    <LogOut className="size-4 shrink-0" />
                    <span className="group-data-[state=collapsed]/sidebar:hidden">Log out</span>
                  </Button>
                </form>
              </div>
            </SidebarFooter>

            <SidebarRail />
          </Sidebar>

          <SidebarInset className="w-full">
            <div className="mb-4 flex sm:hidden">
              <SidebarTrigger
                variant="outline"
                className="border-border/70 bg-background/90 text-foreground shadow-sm"
              />
            </div>
            <section className="min-w-0 w-full flex-1">{children}</section>
          </SidebarInset>
        </div>
      </main>
    </SidebarProvider>
  );
}
