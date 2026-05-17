"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLogin, useSignup } from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { Field, inputClassName } from "./Field";
import { ErrorState } from "./Status";

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const login = useLogin();
  const signup = useSignup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { localization } = useLocalization((state) => ({
    auth: state.localization.auth,
    brand: state.localization.brand,
  }));
  const isSignup = mode === "signup";
  const active = isSignup ? signup : login;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSignup) {
      await signup.mutateAsync({ email, password });
    }
    await login.mutateAsync({ email, password });
    router.push("/chat");
  }

  return (
    <main className="min-h-dvh bg-cal-canvas px-6 py-8">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <section className="cal-card rounded-lg p-8 lg:p-12">
          <p className="cal-label">{localization.brand.name}</p>
          <h1 className="cal-heading mt-5 max-w-xl text-4xl leading-[1.08] lg:text-6xl">
            {localization.auth.heroTitle}
          </h1>
          <p className="cal-subcopy mt-6 max-w-2xl text-lg">
            {localization.auth.heroDescription}
          </p>
          <div className="mt-8 grid gap-3 text-sm sm:grid-cols-3">
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
          className="cal-product-card rounded-xl p-6 lg:p-8"
        >
          <h2 className="cal-heading text-3xl leading-tight">
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
                onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={isSignup ? 8 : 1}
              />
            </Field>
            {active.error ? (
              <ErrorState
                error={active.error}
                title={localization.auth.authenticationFailed}
              />
            ) : null}
            <Button type="submit" size="lg" disabled={active.isPending}>
              {active.isPending
                ? localization.auth.working
                : isSignup
                  ? localization.auth.signupSubmit
                  : localization.auth.loginSubmit}
            </Button>
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
