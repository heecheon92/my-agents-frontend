import { Suspense } from "react";
import { AuthPanel } from "@/components/AuthPanel";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <AuthPanel mode="signup" />
    </Suspense>
  );
}
