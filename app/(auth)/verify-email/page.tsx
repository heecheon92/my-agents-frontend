import { Suspense } from "react";
import { VerifyEmailPanel } from "@/components/keymesh/auth/VerifyEmailPanel";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPanel />
    </Suspense>
  );
}
