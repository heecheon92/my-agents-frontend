import { SourcesSurface } from "@/components/AdminSurfaces";

export default async function KnowledgeSourcePage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;

  return <SourcesSurface initialSourceId={sourceId} />;
}
