"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGuestLogin, useLogin, useSignup } from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { Field, inputClassName } from "./Field";
import { ErrorState } from "./Status";

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const login = useLogin();
  const signup = useSignup();
  const guestLogin = useGuestLogin();
  const [activeMode, setActiveMode] = useState(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState<string | null>(null);
  const { localization } = useLocalization((state) => ({
    auth: state.localization.auth,
    brand: state.localization.brand,
  }));
  const isSignup = activeMode === "signup";
  const active = isSignup ? signup : login;

  async function handleGuestLogin() {
    try {
      await guestLogin.mutateAsync();
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
      <div className="responsive-container grid min-h-[calc(100svh-3rem)] items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <section className="cal-card rounded-lg p-5 sm:p-8 lg:p-12">
          <p className="cal-label">{localization.brand.name}</p>
          <h1 className="cal-heading cal-fluid-display mt-5 max-w-xl">
            {localization.auth.heroTitle}
          </h1>
          <p className="cal-subcopy cal-fluid-subtitle mt-6 max-w-2xl">
            {localization.auth.heroDescription}
          </p>
          <div className="responsive-card-grid mt-8 text-sm">
            {localization.auth.features.map((feature) => (
              <div
                key={feature}
                className="rounded-lg border border-cal-hairline bg-cal-canvas p-4 leading-6 text-cal-body"
              >
                {feature}
              </div>
            ))}
          </div>
        </section>
        <form
          onSubmit={handleSubmit}
          className="cal-product-card rounded-xl p-5 sm:p-6 lg:p-8"
        >
          <h2 className="cal-heading cal-fluid-title">
            {isSignup
              ? localization.auth.createAccount
              : localization.auth.welcomeBack}
          </h2>
          <p className="mt-3 text-sm leading-6 text-cal-muted">
            {isSignup
              ? localization.auth.signupDescription
              : localization.auth.loginDescription}
          </p>
          <div className="mt-8 grid gap-4">
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
                  {localization.auth.signupSuccessTitle}
                </p>
                <p className="mt-1 leading-6">
                  {localization.auth.signupSuccessDescription.replace(
                    "{email}",
                    signupEmail,
                  )}
                </p>
              </div>
            ) : null}
            {active.error ? (
              <ErrorState
                error={active.error}
                title={localization.auth.authenticationFailed}
              />
            ) : null}
            {guestLogin.error ? (
              <ErrorState
                error={guestLogin.error}
                title={localization.auth.guestFailed}
              />
            ) : null}
            <Button
              type="submit"
              size="lg"
              disabled={active.isPending || guestLogin.isPending}
            >
              {active.isPending
                ? localization.auth.working
                : isSignup
                  ? localization.auth.signupSubmit
                  : localization.auth.loginSubmit}
            </Button>
            <div className="grid gap-3 rounded-lg border border-cal-hairline bg-cal-surface-soft p-4 text-sm text-cal-muted">
              <div>
                <p className="font-semibold text-cal-ink">
                  {localization.auth.guestTitle}
                </p>
                <p className="mt-1 leading-6">
                  {localization.auth.guestDescription}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={guestLogin.isPending || active.isPending}
                onClick={handleGuestLogin}
              >
                {guestLogin.isPending
                  ? localization.auth.working
                  : localization.auth.guestSubmit}
              </Button>
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
        </form>
      </div>
    </main>
  );
}
