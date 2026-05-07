import type { ProjectListItem, ProjectRecord } from "@/lib/projects/types";
import { getProjectListStats } from "@/lib/projects/stats";

export function sortProjectsByUpdatedAt<T extends Pick<ProjectListItem, "updatedAt">>(projects: T[]) {
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function mergeProjectIntoList(
  projects: ProjectListItem[],
  project: Pick<ProjectRecord, "id" | "name" | "updatedAt" | "createdAt" | "userId" | "thumbnailDataUrl" | "maxFloors"> &
    Partial<Pick<ProjectRecord, "document">>
) {
  const stats = project.document ? getProjectListStats(project.document) : undefined;
  const nextProjects = projects.some((candidate) => candidate.id === project.id)
    ? projects.map((candidate) =>
        candidate.id === project.id
          ? {
              ...candidate,
              name: project.name,
              thumbnailDataUrl: project.thumbnailDataUrl,
              updatedAt: project.updatedAt,
              maxFloors: project.maxFloors,
              stats: stats ?? candidate.stats,
            }
          : candidate
      )
    : [...projects, { ...project, stats }];

  return sortProjectsByUpdatedAt(nextProjects);
}

export function removeProjectFromList(projects: ProjectListItem[], projectId: string) {
  return projects.filter((project) => project.id !== projectId);
}
