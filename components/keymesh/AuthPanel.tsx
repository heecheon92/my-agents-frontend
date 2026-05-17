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
    <div className="mx-auto grid min-h-dvh w-full max-w-6xl items-center px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          {localization.brand.name}
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-6xl">
          {localization.auth.heroTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          {localization.auth.heroDescription}
        </p>
        <div className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
          {localization.auth.features.map((feature) => (
            <div key={feature} className="rounded-2xl bg-slate-50 p-4">
              {feature}
            </div>
          ))}
        </div>
      </section>
      <form
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-2xl font-semibold text-slate-950">
          {isSignup
            ? localization.auth.createAccount
            : localization.auth.welcomeBack}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {isSignup
            ? localization.auth.signupDescription
            : localization.auth.loginDescription}
        </p>
        <div className="mt-6 grid gap-4">
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
        <p className="mt-6 text-sm text-slate-500">
          {isSignup
            ? localization.auth.alreadyHaveAccount
            : localization.auth.needAccount}{" "}
          <Link
            className="font-medium text-slate-950 underline"
            href={isSignup ? "/login" : "/signup"}
          >
            {isSignup
              ? localization.auth.loginLink
              : localization.auth.signupLink}
          </Link>
        </p>
      </form>
    </div>
  );
}
