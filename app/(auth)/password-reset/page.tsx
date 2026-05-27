import { Suspense } from "react";
import { PasswordResetPanel } from "@/components/keymesh/auth/PasswordResetPanel";

export default function PasswordResetPage() {
  return (
    <Suspense fallback={null}>
      <PasswordResetPanel />
    </Suspense>
  );
}
