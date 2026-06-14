"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAcceptGroupInvitation } from "@/hooks/use-groups";
import { useLocalization } from "@/hooks/useLocalization";
import { ErrorState } from "../Status";

type InvitationAcceptState =
  | "missing-token"
  | "accepting"
  | "accepted"
  | "failed";

export function GroupInvitationAcceptPanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const acceptInvitation = useAcceptGroupInvitation();
  const requestedToken = useRef<string | null>(null);
  const [state, setState] = useState<InvitationAcceptState>(
    token ? "accepting" : "missing-token",
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
    setState("accepting");
    acceptInvitation.mutate(
      { token },
      {
        onSuccess: () => {
          setState("accepted");
        },
        onError: () => {
          setState("failed");
        },
      },
    );
  }, [token, acceptInvitation]);

  const title =
    state === "accepted"
      ? localization.auth.groupInvitationSuccessTitle
      : state === "failed"
        ? localization.auth.groupInvitationFailedTitle
        : state === "missing-token"
          ? localization.auth.groupInvitationMissingTitle
          : localization.auth.groupInvitationWorkingTitle;
  const description =
    state === "accepted"
      ? localization.auth.groupInvitationSuccessDescription
      : state === "failed"
        ? localization.auth.groupInvitationFailedDescription
        : state === "missing-token"
          ? localization.auth.groupInvitationMissingDescription
          : localization.auth.groupInvitationWorkingDescription;

  return (
    <main className="min-h-dvh bg-cal-canvas py-6 sm:py-8">
      <div className="responsive-container flex min-h-[calc(100svh-3rem)] items-center justify-center">
        <section className="cal-product-card w-full max-w-md rounded-xl p-5 sm:p-6 lg:p-8">
          <p className="cal-label">
            {localization.auth.groupInvitationEyebrow}
          </p>
          <h2 className="cal-heading mt-3 text-[clamp(1.5rem,5vw,2rem)] leading-tight tracking-[-0.03em]">
            {title}
          </h2>
          <p className="mt-4 text-sm leading-6 text-cal-muted">{description}</p>
          {state === "failed" && acceptInvitation.error ? (
            <div className="mt-5">
              <ErrorState
                error={acceptInvitation.error}
                title={localization.auth.groupInvitationFailedTitle}
              />
            </div>
          ) : null}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button
              nativeButton={false}
              render={<Link href="/groups" />}
              size="lg"
            >
              {localization.auth.groupsLink}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/login" />}
              size="lg"
              variant="outline"
            >
              {localization.auth.loginLink}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
