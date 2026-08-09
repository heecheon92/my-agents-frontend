"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, inputClassName } from "@/components/Field";
import { ErrorState } from "@/components/Status";
import { Button, buttonVariants } from "@/components/ui/button";
import { useGuestAccessRequest, useGuestCodeLogin } from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";

/**
 * Guest access, on its own route.
 *
 * Both steps used to sit permanently below the login form, so every visitor —
 * including the overwhelming majority signing in normally — read two extra
 * forms before reaching the one they wanted. They live here instead, reached by
 * an explicit link from `/login`.
 *
 * The two steps stay on one page rather than splitting across routes: they are
 * one flow separated by an email round-trip, and a returning visitor with a
 * code in hand lands directly on the form that takes it.
 */
export function GuestAccessPanel() {
  const router = useRouter();
  const guestAccessRequest = useGuestAccessRequest();
  const guestCodeLogin = useGuestCodeLogin();
  const [guestEmail, setGuestEmail] = useState("");
  const [guestCode, setGuestCode] = useState("");
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const { localization } = useLocalization((state) => state.localization.auth);

  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = guestEmail.trim();
    try {
      await guestAccessRequest.mutateAsync({ email: trimmedEmail });
      setRequestedEmail(trimmedEmail);
    } catch {
      // React Query stores the API error on the mutation; rendered below.
    }
  }

  async function handleCodeLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await guestCodeLogin.mutateAsync(guestCode.trim());
      router.push("/chat?guest=1");
    } catch {
      // React Query stores the API error on the mutation; rendered below.
    }
  }

  const isBusy = guestAccessRequest.isPending || guestCodeLogin.isPending;

  return (
    <main className="min-h-dvh bg-cal-canvas py-6 sm:py-8">
      <div className="responsive-container flex min-h-[calc(100svh-3rem)] items-center justify-center">
        <section className="cal-product-card w-full max-w-md rounded-card p-5 sm:p-6 lg:p-8">
          <p className="cal-label">{localization.guestPageEyebrow}</p>
          <h1 className="cal-heading mt-2 text-[clamp(1.5rem,5vw,2rem)] leading-tight">
            {localization.guestPageTitle}
          </h1>
          <p className="mt-3 text-sm leading-6 text-cal-muted">
            {localization.guestPageDescription}
          </p>

          <section className="mt-8 grid gap-3">
            <h2 className="text-sm font-semibold text-cal-ink">
              {localization.guestRequestStepTitle}
            </h2>
            <p className="text-sm leading-6 text-cal-muted">
              {localization.guestDescription}
            </p>
            {guestAccessRequest.error ? (
              <ErrorState
                error={guestAccessRequest.error}
                title={localization.guestFailed}
              />
            ) : null}
            <form onSubmit={handleRequest} className="grid gap-3">
              <Field
                label={localization.guestEmailLabel}
                hint={localization.guestEmailHint}
              >
                <input
                  className={inputClassName}
                  type="email"
                  autoComplete="email"
                  value={guestEmail}
                  onChange={(event) => {
                    setGuestEmail(event.target.value);
                    setRequestedEmail(null);
                  }}
                  required
                />
              </Field>
              <Button
                type="submit"
                variant="outline"
                disabled={guestAccessRequest.isPending}
              >
                {guestAccessRequest.isPending
                  ? localization.working
                  : localization.guestRequestSubmit}
              </Button>
            </form>
            {requestedEmail ? (
              <output
                aria-live="polite"
                className="rounded-control border border-cal-success/20 bg-cal-success/5 p-4 text-sm text-cal-success"
              >
                <p className="font-semibold">
                  {localization.guestRequestReceivedTitle}
                </p>
                <p className="mt-1 leading-6">
                  {localization.guestRequestReceivedDescription.replace(
                    "{email}",
                    requestedEmail,
                  )}
                </p>
              </output>
            ) : null}
          </section>

          <section className="mt-6 grid gap-3 border-t border-cal-hairline pt-6">
            <h2 className="text-sm font-semibold text-cal-ink">
              {localization.guestCodeStepTitle}
            </h2>
            <p className="text-sm leading-6 text-cal-muted">
              {localization.guestCodeDescription}
            </p>
            {guestCodeLogin.error ? (
              <ErrorState
                error={guestCodeLogin.error}
                title={localization.guestFailed}
              />
            ) : null}
            <form onSubmit={handleCodeLogin} className="grid gap-3">
              <Field
                label={localization.guestCodeLabel}
                hint={localization.guestCodeHint}
              >
                <input
                  className={inputClassName}
                  type="text"
                  autoComplete="one-time-code"
                  value={guestCode}
                  onChange={(event) => setGuestCode(event.target.value)}
                  required
                />
              </Field>
              <Button type="submit" disabled={isBusy}>
                {guestCodeLogin.isPending
                  ? localization.working
                  : localization.guestCodeSubmit}
              </Button>
            </form>
          </section>

          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }), "mt-6 w-full")}
          >
            <ArrowLeftIcon aria-hidden="true" />
            {localization.backToLoginLink}
          </Link>
        </section>
      </div>
    </main>
  );
}
