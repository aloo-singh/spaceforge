import type { ProjectListItem, ProjectRecord } from "@/lib/projects/types";

export function sortProjectsByUpdatedAt<T extends Pick<ProjectListItem, "updatedAt">>(projects: T[]) {
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function mergeProjectIntoList(
  projects: ProjectListItem[],
  project: Pick<ProjectRecord, "id" | "name" | "updatedAt" | "createdAt" | "userId">
) {
  const nextProjects = projects.some((candidate) => candidate.id === project.id)
    ? projects.map((candidate) =>
        candidate.id === project.id
          ? {
              ...candidate,
              name: project.name,
              updatedAt: project.updatedAt,
            }
          : candidate
      )
    : [...projects, project];

  return sortProjectsByUpdatedAt(nextProjects);
}

export function removeProjectFromList(projects: ProjectListItem[], projectId: string) {
  return projects.filter((project) => project.id !== projectId);
}
