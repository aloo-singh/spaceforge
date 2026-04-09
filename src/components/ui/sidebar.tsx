"use client";

import * as React from "react";
import { PanelLeft } from "@/components/ui/icons";
import { Collapsible, Slot } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useMobile } from "@/lib/use-mobile";
import { cn } from "@/lib/utils";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "18rem";
const SIDEBAR_WIDTH_ICON = "4.5rem";

type SidebarContextValue = {
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  state: "expanded" | "collapsed";
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

type SidebarProviderProps = React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
};

function SidebarProvider({
  defaultOpen = true,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const { isMobile } = useMobile();
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);

  React.useEffect(() => {
    const cookieValue = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
      ?.split("=")[1];

    if (cookieValue === "true" || cookieValue === "false") {
      setOpen(cookieValue === "true");
    }
  }, []);

  React.useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  }, [open]);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((current) => !current);
      return;
    }

    setOpen((current) => !current);
  }, [isMobile]);

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      isMobile,
      open,
      openMobile,
      setOpen,
      setOpenMobile,
      state: open ? "expanded" : "collapsed",
      toggleSidebar,
    }),
    [isMobile, open, openMobile, toggleSidebar]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn("group/sidebar-wrapper flex min-h-[calc(100vh-3.5rem)] w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

type SidebarProps = React.ComponentProps<"aside"> & {
  side?: "left" | "right";
  collapsible?: "offcanvas" | "icon" | "none";
};

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ side = "left", collapsible = "icon", className, children, ...props }, ref) => {
    const { isMobile, openMobile, setOpenMobile, state } = useSidebar();
    const collapsibleState = collapsible === "none" ? "" : state;

    if (isMobile) {
      return (
        <Drawer direction={side} open={openMobile} onOpenChange={setOpenMobile}>
          <DrawerContent
            side={side}
            className="w-[min(20rem,calc(100vw-1.5rem))] p-0 sm:hidden"
          >
            <aside
              ref={ref}
              data-slot="sidebar"
              data-mobile="true"
              className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground"
              {...props}
            >
              {children}
            </aside>
          </DrawerContent>
        </Drawer>
      );
    }

    return (
      <aside
        ref={ref}
        data-slot="sidebar"
        data-state={collapsibleState}
        data-collapsible={collapsible}
        className={cn(
          "group/sidebar relative hidden shrink-0 text-sidebar-foreground sm:block",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "relative h-full w-[var(--sidebar-width)] transition-[width] duration-200 ease-linear",
            collapsible === "icon" && "group-data-[state=collapsed]/sidebar:w-[var(--sidebar-width-icon)]"
          )}
        >
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-sidebar-border/70 bg-sidebar/95 shadow-sm">
            {children}
          </div>
        </div>
      </aside>
    );
  }
);
Sidebar.displayName = "Sidebar";

const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", className)}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          toggleSidebar();
        }
      }}
      {...props}
    >
      <PanelLeft className="size-4" />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();

    return (
      <button
        ref={ref}
        type="button"
        aria-label="Toggle sidebar"
        className={cn(
          "absolute top-0 right-0 hidden h-full w-4 translate-x-1/2 cursor-ew-resize rounded-full border border-transparent transition-colors hover:bg-sidebar-accent/40 sm:flex",
          className
        )}
        onClick={toggleSidebar}
        {...props}
      />
    );
  }
);
SidebarRail.displayName = "SidebarRail";

const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-inset" className={cn("min-w-0 flex-1", className)} {...props} />
  )
);
SidebarInset.displayName = "SidebarInset";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-header"
      className={cn("flex flex-col gap-4 border-b border-sidebar-border/60 p-4", className)}
      {...props}
    />
  )
);
SidebarHeader.displayName = "SidebarHeader";

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4", className)}
      {...props}
    />
  )
);
SidebarContent.displayName = "SidebarContent";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-footer"
      className={cn("border-t border-sidebar-border/60 p-4", className)}
      {...props}
    />
  )
);
SidebarFooter.displayName = "SidebarFooter";

const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-group" className={cn("flex flex-col gap-2", className)} {...props} />
  )
);
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="sidebar-group-label"
      className={cn(
        "font-measurement text-[10px] font-semibold tracking-[0.18em] text-sidebar-foreground/45 uppercase transition-opacity group-data-[state=collapsed]/sidebar:opacity-0",
        className
      )}
      {...props}
    />
  )
);
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-group-content" className={cn("flex flex-col gap-2", className)} {...props} />
  )
);
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} data-slot="sidebar-menu" className={cn("flex flex-col gap-2", className)} {...props} />
  )
);
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => (
    <li ref={ref} data-slot="sidebar-menu-item" className={cn("list-none", className)} {...props} />
  )
);
SidebarMenuItem.displayName = "SidebarMenuItem";

type SidebarMenuButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
};

const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ asChild = false, isActive = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";

    return (
      <Comp
        ref={ref}
        data-slot="sidebar-menu-button"
        data-active={isActive}
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-2.5",
          className
        )}
        {...props}
      />
    );
  }
);
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-slot="sidebar-menu-sub"
      className={cn(
        "ml-5 flex flex-col gap-1 border-l border-sidebar-border/60 pl-3 group-data-[state=collapsed]/sidebar:hidden",
        className
      )}
      {...props}
    />
  )
);
SidebarMenuSub.displayName = "SidebarMenuSub";

const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => (
    <li ref={ref} data-slot="sidebar-menu-sub-item" className={cn("list-none", className)} {...props} />
  )
);
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

type SidebarMenuSubButtonProps = React.ComponentProps<"a"> & {
  asChild?: boolean;
  isActive?: boolean;
};

const SidebarMenuSubButton = React.forwardRef<HTMLAnchorElement, SidebarMenuSubButtonProps>(
  ({ asChild = false, isActive = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "a";

    return (
      <Comp
        ref={ref}
        data-slot="sidebar-menu-sub-button"
        data-active={isActive}
        className={cn(
          "flex min-h-9 w-full items-center rounded-xl px-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
          className
        )}
        {...props}
      />
    );
  }
);
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

export {
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
  useSidebar,
};
