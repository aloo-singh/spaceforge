import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import type { ProjectListItem } from "@/lib/projects/types";
import { formatProjectUpdatedAt } from "@/lib/projects/formatting";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ProjectCardProps = {
  project: ProjectListItem;
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Card className="border-border/70 bg-card/75 transition-colors hover:border-border hover:bg-card">
      <CardContent className="flex h-full flex-col gap-5 p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-base font-medium tracking-tight text-foreground">{project.name}</p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-3.5" />
                <span>{formatProjectUpdatedAt(project.updatedAt)}</span>
              </p>
            </div>
            <div className="rounded-full border border-border/70 px-2 py-1 font-mono text-[11px] text-foreground/55">
              Project
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <Link
            href={`/editor/${project.id}`}
            className="text-sm text-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            Open project
          </Link>
          <Button asChild size="sm" className="bg-blue-500 text-white hover:bg-blue-500/90">
            <Link href={`/editor/${project.id}`}>
              Open
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
