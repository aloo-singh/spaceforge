import { EditorPageShell } from "@/components/editor/EditorPageShell";

type EditorProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function EditorProjectPage({ params }: EditorProjectPageProps) {
  const { projectId } = await params;
  return <EditorPageShell projectId={projectId} />;
}
