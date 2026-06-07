"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useGuestAccessRequest,
  useGuestCodeLogin,
  useLogin,
  useSignup,
} from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { Field, inputClassName } from "./Field";
import { ErrorState } from "./Status";

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const login = useLogin();
  const signup = useSignup();
  const guestAccessRequest = useGuestAccessRequest();
  const guestCodeLogin = useGuestCodeLogin();
  const [activeMode, setActiveMode] = useState(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestCode, setGuestCode] = useState("");
  const [guestRequestEmail, setGuestRequestEmail] = useState<string | null>(
    null,
  );
  const [signupEmail, setSignupEmail] = useState<string | null>(null);
  const [signupApprovalRequired, setSignupApprovalRequired] = useState(false);
  const { localization } = useLocalization((state) => ({
    auth: state.localization.auth,
  }));
  const isSignup = activeMode === "signup";
  const active = isSignup ? signup : login;
  const isGuestPending =
    guestAccessRequest.isPending || guestCodeLogin.isPending;

  async function handleGuestAccessRequest(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const trimmedEmail = guestEmail.trim();
    try {
      await guestAccessRequest.mutateAsync({ email: trimmedEmail });
      setGuestRequestEmail(trimmedEmail);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleGuestCodeLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await guestCodeLogin.mutateAsync(guestCode.trim());
      router.push("/chat?guest=1");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSignup) {
      try {
        const result = await signup.mutateAsync({ email, password });
        const createdEmail = result.user.email ?? email;
        setEmail(createdEmail);
        setSignupEmail(createdEmail);
        setSignupApprovalRequired(result.approval_required);
        setPassword("");
        setActiveMode("login");
      } catch {
        // React Query stores the API error on the mutation; render it below.
      }
      return;
    }
    try {
      await login.mutateAsync({ email, password });
      router.push("/chat");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <main className="min-h-dvh bg-cal-canvas py-6 sm:py-8">
      <div className="responsive-container flex min-h-[calc(100svh-3rem)] items-center justify-center">
        <section className="cal-product-card w-full max-w-md rounded-xl p-5 sm:p-6 lg:p-8">
          <h2
            className={
              !isSignup
                ? "cal-heading text-[clamp(1.5rem,5vw,2rem)] leading-tight tracking-[-0.03em]"
                : "cal-heading cal-fluid-title"
            }
          >
            {isSignup
              ? localization.auth.createAccount
              : localization.auth.welcomeBack}
          </h2>
          {isSignup ? (
            <p className="mt-3 text-sm leading-6 text-cal-muted">
              {localization.auth.signupDescription}
            </p>
          ) : null}
          <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
            <Field label={localization.auth.email}>
              <input
                className={inputClassName}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                required
              />
            </Field>
            <Field
              label={localization.auth.password}
              hint={isSignup ? localization.auth.passwordHint : undefined}
            >
              <input
                className={inputClassName}
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                required
                minLength={isSignup ? 8 : 1}
              />
            </Field>
            {signupEmail ? (
              <div className="rounded-lg border border-cal-success/20 bg-cal-success/5 p-4 text-sm text-cal-success">
                <p className="font-semibold">
                  {signupApprovalRequired
                    ? localization.auth.signupPendingApprovalTitle
                    : localization.auth.signupSuccessTitle}
                </p>
                <p className="mt-1 leading-6">
                  {(signupApprovalRequired
                    ? localization.auth.signupPendingApprovalDescription
                    : localization.auth.signupSuccessDescription
                  ).replace("{email}", signupEmail)}
                </p>
              </div>
            ) : null}
            {active.error ? (
              <ErrorState
                error={active.error}
                title={localization.auth.authenticationFailed}
              />
            ) : null}
            <Button
              type="submit"
              size="lg"
              disabled={active.isPending || isGuestPending}
            >
              {active.isPending
                ? localization.auth.working
                : isSignup
                  ? localization.auth.signupSubmit
                  : localization.auth.loginSubmit}
            </Button>
          </form>
          <div className="mt-4 grid gap-4 rounded-lg border border-cal-hairline bg-cal-surface-soft p-4 text-sm text-cal-muted">
            <div>
              <p className="font-semibold text-cal-ink">
                {localization.auth.guestTitle}
              </p>
              <p className="mt-1 leading-6">
                {localization.auth.guestDescription}
              </p>
            </div>
            {guestAccessRequest.error ? (
              <ErrorState
                error={guestAccessRequest.error}
                title={localization.auth.guestFailed}
              />
            ) : null}
            <form onSubmit={handleGuestAccessRequest} className="grid gap-3">
              <Field
                label={localization.auth.guestEmailLabel}
                hint={localization.auth.guestEmailHint}
              >
                <input
                  className={inputClassName}
                  type="email"
                  autoComplete="email"
                  value={guestEmail}
                  onChange={(event) => {
                    setGuestEmail(event.target.value);
                    setGuestRequestEmail(null);
                  }}
                  required
                />
              </Field>
              <Button
                type="submit"
                variant="outline"
                disabled={guestAccessRequest.isPending || active.isPending}
              >
                {guestAccessRequest.isPending
                  ? localization.auth.working
                  : localization.auth.guestRequestSubmit}
              </Button>
            </form>
            {guestRequestEmail ? (
              <output
                aria-live="polite"
                className="rounded-lg border border-cal-success/20 bg-cal-success/5 p-4 text-sm text-cal-success"
              >
                <p className="font-semibold">
                  {localization.auth.guestRequestReceivedTitle}
                </p>
                <p className="mt-1 leading-6">
                  {localization.auth.guestRequestReceivedDescription.replace(
                    "{email}",
                    guestRequestEmail,
                  )}
                </p>
              </output>
            ) : null}
            <div className="grid gap-3 border-t border-cal-hairline pt-4">
              <div>
                <p className="font-semibold text-cal-ink">
                  {localization.auth.guestCodeTitle}
                </p>
                <p className="mt-1 leading-6">
                  {localization.auth.guestCodeDescription}
                </p>
              </div>
              {guestCodeLogin.error ? (
                <ErrorState
                  error={guestCodeLogin.error}
                  title={localization.auth.guestFailed}
                />
              ) : null}
              <form onSubmit={handleGuestCodeLogin} className="grid gap-3">
                <Field
                  label={localization.auth.guestCodeLabel}
                  hint={localization.auth.guestCodeHint}
                >
                  <input
                    className={inputClassName}
                    type="text"
                    autoComplete="one-time-code"
                    value={guestCode}
                    onChange={(event) => {
                      setGuestCode(event.target.value);
                    }}
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={guestCodeLogin.isPending || active.isPending}
                >
                  {guestCodeLogin.isPending
                    ? localization.auth.working
                    : localization.auth.guestCodeSubmit}
                </Button>
              </form>
            </div>
          </div>
          <p className="mt-6 text-sm text-cal-muted">
            {isSignup
              ? localization.auth.alreadyHaveAccount
              : localization.auth.needAccount}{" "}
            <Link
              className="font-semibold text-cal-ink underline underline-offset-4"
              href={isSignup ? "/login" : "/signup"}
            >
              {isSignup
                ? localization.auth.loginLink
                : localization.auth.signupLink}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
