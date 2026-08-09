"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PasswordResetRequestDialog } from "@/components/auth/PasswordResetRequestDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLogin, useSignup } from "@/hooks/use-auth";
import { useSignupFromGroupInvitation } from "@/hooks/use-groups";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { Field, inputClassName } from "./Field";
import { ErrorState } from "./Status";

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token")?.trim() ?? "";
  const login = useLogin();
  const signup = useSignup();
  const inviteSignup = useSignupFromGroupInvitation();
  const [activeMode, setActiveMode] = useState(mode);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState<string | null>(null);
  const [signupApprovalRequired, setSignupApprovalRequired] = useState(false);
  const { localization } = useLocalization((state) => ({
    auth: state.localization.auth,
  }));
  const isSignup = activeMode === "signup";
  const isInviteSignup = isSignup && Boolean(inviteToken);
  const active = isInviteSignup ? inviteSignup : isSignup ? signup : login;
  const inviteTokenQuery = inviteToken
    ? `?invite_token=${encodeURIComponent(inviteToken)}`
    : "";
  const invitationAcceptHref = inviteToken
    ? `/group-invitations/accept?token=${encodeURIComponent(inviteToken)}`
    : "/groups";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isInviteSignup) {
      try {
        await inviteSignup.mutateAsync({
          token: inviteToken,
          nickname: nickname.trim(),
          password,
        });
        router.push("/groups");
      } catch {
        // React Query stores the API error on the mutation; render it below.
      }
      return;
    }
    if (isSignup) {
      try {
        const result = await signup.mutateAsync({
          email,
          password,
          nickname: nickname.trim(),
        });
        const createdEmail = result.user.email ?? email;
        setEmail(createdEmail);
        setSignupEmail(createdEmail);
        setSignupApprovalRequired(result.approval_required);
        setNickname("");
        setPassword("");
        setActiveMode("login");
      } catch {
        // React Query stores the API error on the mutation; render it below.
      }
      return;
    }
    try {
      await login.mutateAsync({ email, password });
      router.push(inviteToken ? invitationAcceptHref : "/chat");
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
                ? "cal-heading text-[clamp(1.5rem,5vw,2rem)] leading-tight"
                : "cal-heading cal-fluid-title"
            }
          >
            {isSignup
              ? localization.auth.createAccount
              : localization.auth.welcomeBack}
          </h2>
          {isInviteSignup ? (
            <div className="mt-4 rounded-lg border border-cal-hairline bg-cal-surface-soft p-4 text-sm">
              <p className="font-semibold text-cal-ink">
                {localization.auth.groupInvitationSignupTitle}
              </p>
              <p className="mt-1 leading-6 text-cal-muted">
                {localization.auth.groupInvitationSignupDescription}
              </p>
            </div>
          ) : isSignup ? (
            <p className="mt-3 text-sm leading-6 text-cal-muted">
              {localization.auth.signupDescription}
            </p>
          ) : inviteToken ? (
            <div className="mt-4 rounded-lg border border-cal-hairline bg-cal-surface-soft p-4 text-sm">
              <p className="font-semibold text-cal-ink">
                {localization.auth.groupInvitationLoginTitle}
              </p>
              <p className="mt-1 leading-6 text-cal-muted">
                {localization.auth.groupInvitationLoginDescription}
              </p>
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
            {!isInviteSignup ? (
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
            ) : null}
            {isSignup ? (
              <Field
                label={localization.auth.nickname}
                hint={localization.auth.nicknameHint}
              >
                <input
                  className={inputClassName}
                  type="text"
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                  }}
                  required
                  maxLength={40}
                />
              </Field>
            ) : null}
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
            {!isSignup ? (
              <PasswordResetRequestDialog localization={localization.auth}>
                <button
                  type="button"
                  className="justify-self-start text-sm font-medium text-km-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-km-accent"
                >
                  {localization.auth.passwordResetRequestLink}
                </button>
              </PasswordResetRequestDialog>
            ) : null}
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
            <Button type="submit" size="lg" disabled={active.isPending}>
              {active.isPending
                ? localization.auth.working
                : isSignup
                  ? localization.auth.signupSubmit
                  : localization.auth.loginSubmit}
            </Button>
          </form>
          {/*
            Guest access lives on `/guest`. It used to sit here permanently, so
            every visitor read two extra forms — request a code, then redeem one
            — before reaching the sign-in they came for. It is one link now.
            Hidden during invite signup, where the path is already decided.
          */}
          {!isInviteSignup ? (
            <div className="mt-6 border-t border-cal-hairline pt-6">
              {/* A real <Link>, not `Button render={<Link/>}`: Base UI keeps
                  role="button" on the anchor, which costs screen-reader users
                  the "link" affordance and browsers the open-in-new-tab
                  behaviour. `buttonVariants` gives the same appearance. */}
              <Link
                href="/guest"
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                {localization.auth.guestAccessLink}
              </Link>
              <p className="mt-2 text-center text-xs leading-5 text-cal-muted">
                {localization.auth.guestTitle}
              </p>
            </div>
          ) : null}
          <p className="mt-6 text-sm text-cal-muted">
            {isSignup
              ? localization.auth.alreadyHaveAccount
              : localization.auth.needAccount}{" "}
            <Link
              className="font-semibold text-cal-ink underline underline-offset-4"
              href={
                isSignup
                  ? `/login${inviteTokenQuery}`
                  : `/signup${inviteTokenQuery}`
              }
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
