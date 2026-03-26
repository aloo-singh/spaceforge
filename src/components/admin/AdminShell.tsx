import Link from "next/link";
import { BarChart3, Inbox, LogOut, Mail } from "lucide-react";

import { logoutAdminAction } from "@/app/admin/actions";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
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

export function AdminShell({ userEmail, unreadFeedbackCount, children }: AdminShellProps) {
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

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu aria-label="Admin sections">
                    {adminNavItems.map((item) => {
                      const Icon = item.icon;

                      if (item.isDisabled) {
                        return (
                          <SidebarMenuItem key={item.label}>
                            <SidebarMenuButton
                              type="button"
                              disabled
                              title={item.label}
                              className="text-sidebar-foreground/55 hover:bg-transparent hover:text-sidebar-foreground/55"
                            >
                              <Icon className="mt-0.5 size-4 shrink-0 text-sidebar-foreground/55" />
                              <span className="min-w-0 space-y-1 group-data-[state=collapsed]/sidebar:hidden">
                                <span className="block text-sm font-medium">{item.label}</span>
                                <span className="block text-xs text-sidebar-foreground/55">
                                  {item.description}
                                </span>
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      }

                      return (
                        <SidebarMenuItem key={item.label}>
                          <SidebarMenuButton
                            asChild
                            isActive={item.isActive}
                            title={item.label}
                            className="shadow-none"
                          >
                            <Link href={item.href} aria-current={item.isActive ? "page" : undefined}>
                              <Icon className="mt-0.5 size-4 shrink-0" />
                              <span className="min-w-0 space-y-1 group-data-[state=collapsed]/sidebar:hidden">
                                <span className="flex items-center gap-2">
                                  <span className="block text-sm font-medium">{item.label}</span>
                                  {item.label === "Feedback Inbox" && unreadFeedbackCount > 0 ? (
                                    <Badge
                                      variant="secondary"
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
