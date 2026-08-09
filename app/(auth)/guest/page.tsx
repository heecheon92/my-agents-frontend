import { Suspense } from "react";
import { GuestAccessPanel } from "@/components/auth/GuestAccessPanel";

export default function GuestAccessPage() {
  return (
    <Suspense fallback={null}>
      <GuestAccessPanel />
    </Suspense>
  );
}
