"use client";

import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type BreadcrumbItem_ = {
  label: string;
  onClick?: () => void;
};

type EditorInspectorSectionProps = {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem_[];
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

export function EditorInspectorSection({
  title,
  description,
  breadcrumbs,
  className,
  bodyClassName,
  children,
}: EditorInspectorSectionProps) {
  return (
    <section
      className={cn(
        "pointer-events-auto rounded-xl border border-border/70 bg-card/95 p-4 text-card-foreground shadow-sm backdrop-blur-sm [@media(max-height:540px)_and_(orientation:landscape)]:p-3",
        className
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div className="mb-3 pb-3 border-b border-border/60">
          <Breadcrumb>
            <BreadcrumbList className="text-[11px]">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <div key={index} className="flex items-center gap-1.5">
                    {isLast ? (
                      <BreadcrumbPage className="font-medium text-foreground">
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <>
                        <BreadcrumbLink
                          onClick={item.onClick}
                          className={item.onClick ? "cursor-pointer" : ""}
                        >
                          {item.label}
                        </BreadcrumbLink>
                        <BreadcrumbSeparator />
                      </>
                    )}
                  </div>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      ) : null}
      <header className="space-y-1 border-b border-border/60 pb-3 [@media(max-height:540px)_and_(orientation:landscape)]:pb-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground [@media(max-height:540px)_and_(orientation:landscape)]:text-[10px]">
          {title}
        </p>
        {description ? (
          <p className="max-w-[28ch] text-sm leading-relaxed text-muted-foreground [@media(max-height:540px)_and_(orientation:landscape)]:max-w-[24ch] [@media(max-height:540px)_and_(orientation:landscape)]:text-[13px]">
            {description}
          </p>
        ) : null}
      </header>
      <div className={cn("pt-4 [@media(max-height:540px)_and_(orientation:landscape)]:pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}
