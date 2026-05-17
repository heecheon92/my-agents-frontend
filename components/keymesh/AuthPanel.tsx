"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLogin, useSignup } from "@/hooks/use-auth";
import { Field, inputClassName } from "./Field";
import { ErrorState } from "./Status";

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const login = useLogin();
  const signup = useSignup();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          my-agents
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-6xl">
          A portfolio-grade AI service console.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Authenticate into a FastAPI + LangGraph backend, run real conversation
          workflows, and inspect citations, documents, groups, and safe agent
          activity.
        </p>
        <div className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            Conversation runs, not legacy smoke chat.
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            BFF-protected session and CSRF flow.
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            Followable Greet-style structure.
          </div>
        </div>
      </section>
      <form
        onSubmit={handleSubmit}
        className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-2xl font-semibold text-slate-950">
          {isSignup ? "Create account" : "Welcome back"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {isSignup
            ? "Sign up, then you will be logged in automatically."
            : "Use the backend auth session to enter the console."}
        </p>
        <div className="mt-6 grid gap-4">
          <Field label="Email">
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
            label="Password"
            hint={isSignup ? "At least 8 characters." : undefined}
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
            <ErrorState error={active.error} title="Authentication failed" />
          ) : null}
          <Button type="submit" size="lg" disabled={active.isPending}>
            {active.isPending
              ? "Working..."
              : isSignup
                ? "Sign up and enter"
                : "Log in"}
          </Button>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          {isSignup ? "Already have an account?" : "Need an account?"}{" "}
          <Link
            className="font-medium text-slate-950 underline"
            href={isSignup ? "/login" : "/signup"}
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </form>
    </div>
  );
}
