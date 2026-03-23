"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import type { ProjectListItem } from "@/lib/projects/types";

type ProjectDeleteDialogProps = {
  project: ProjectListItem | null;
  open: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
};

export function ProjectDeleteDialog({
  project,
  open,
  isDeleting,
  onOpenChange,
  onConfirmDelete,
}: ProjectDeleteDialogProps) {
  return (
    <ResponsiveAlertDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete project?"
      description={
        project
          ? `Delete "${project.name}" permanently. This action cannot be undone.`
          : "Delete this project permanently. This action cannot be undone."
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirmDelete}
            disabled={isDeleting || project === null}
            className="w-full sm:w-auto"
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete project"}
          </Button>
        </>
      }
    />
  );
}
