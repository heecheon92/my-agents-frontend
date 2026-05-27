"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useVerifyEmail } from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { ErrorState } from "../Status";

type VerificationState = "missing-token" | "verifying" | "verified" | "failed";

export function VerifyEmailPanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const verifyEmail = useVerifyEmail();
  const requestedToken = useRef<string | null>(null);
  const [state, setState] = useState<VerificationState>(
    token ? "verifying" : "missing-token",
  );
  const { localization } = useLocalization((current) => ({
    auth: current.localization.auth,
  }));

  useEffect(() => {
    if (!token) {
      setState("missing-token");
      requestedToken.current = null;
      return;
    }
    if (requestedToken.current === token) return;
    requestedToken.current = token;
    setState("verifying");
    verifyEmail.mutate(
      { token },
      {
        onSuccess: () => {
          setState("verified");
        },
        onError: () => {
          setState("failed");
        },
      },
    );
  }, [token, verifyEmail]);

  return (
    <main className="min-h-dvh bg-cal-canvas py-6 sm:py-8">
      <div className="responsive-container flex min-h-[calc(100svh-3rem)] items-center justify-center">
        <section className="cal-product-card w-full max-w-md rounded-xl p-5 sm:p-6 lg:p-8">
          <p className="cal-label">
            {localization.auth.emailVerificationEyebrow}
          </p>
          <h2 className="cal-heading mt-3 text-[clamp(1.5rem,5vw,2rem)] leading-tight tracking-[-0.03em]">
            {state === "verified"
              ? localization.auth.emailVerificationSuccessTitle
              : state === "failed"
                ? localization.auth.emailVerificationFailedTitle
                : state === "missing-token"
                  ? localization.auth.emailVerificationMissingTitle
                  : localization.auth.emailVerificationWorkingTitle}
          </h2>
          <p className="mt-4 text-sm leading-6 text-cal-muted">
            {state === "verified"
              ? localization.auth.emailVerificationSuccessDescription
              : state === "failed"
                ? localization.auth.emailVerificationFailedDescription
                : state === "missing-token"
                  ? localization.auth.emailVerificationMissingDescription
                  : localization.auth.emailVerificationWorkingDescription}
          </p>
          {state === "failed" && verifyEmail.error ? (
            <div className="mt-5">
              <ErrorState
                error={verifyEmail.error}
                title={localization.auth.emailVerificationFailedTitle}
              />
            </div>
          ) : null}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button render={<Link href="/login" />} size="lg">
              {localization.auth.loginLink}
            </Button>
            <Button
              render={<Link href="/signup" />}
              size="lg"
              variant="outline"
            >
              {localization.auth.signupLink}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
