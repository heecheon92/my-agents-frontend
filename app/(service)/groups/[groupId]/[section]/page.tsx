import { notFound } from "next/navigation";
import {
  type GroupManagementSection,
  GroupsSurface,
} from "@/components/AdminSurfaces";

const groupManagementSections = new Set<string>([
  "members",
  "invitations",
  "source-spaces",
  "publish-requests",
]);

export default async function GroupManagementPage({
  params,
}: {
  params: Promise<{ groupId: string; section: string }>;
}) {
  const { groupId, section } = await params;

  if (!groupManagementSections.has(section)) {
    notFound();
  }

  return (
    <GroupsSurface
      initialGroupId={groupId}
      initialSection={section as GroupManagementSection}
    />
  );
}
