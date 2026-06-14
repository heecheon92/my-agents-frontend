import { GroupsSurface } from "@/components/AdminSurfaces";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  return <GroupsSurface initialGroupId={groupId} />;
}
