import { Suspense } from "react";
import { GroupInvitationAcceptPanel } from "@/components/auth/GroupInvitationAcceptPanel";

export default function GroupInvitationAcceptPage() {
  return (
    <Suspense fallback={null}>
      <GroupInvitationAcceptPanel />
    </Suspense>
  );
}
