"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirmPasswordReset } from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { Field, inputClassName } from "../Field";
import { ErrorState } from "../Status";

export function PasswordResetPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const confirmPasswordReset = useConfirmPasswordReset();
  const [password, setPassword] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const { localization } = useLocalization((current) => ({
    auth: current.localization.auth,
  }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    try {
      await confirmPasswordReset.mutateAsync({ token, new_password: password });
      setPassword("");
      setIsComplete(true);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <main className="min-h-dvh bg-cal-canvas py-6 sm:py-8">
      <div className="responsive-container flex min-h-[calc(100svh-3rem)] items-center justify-center">
        <section className="cal-product-card w-full max-w-md rounded-xl p-5 sm:p-6 lg:p-8">
          <p className="cal-label">{localization.auth.passwordResetEyebrow}</p>
          <h2 className="cal-heading mt-3 text-[clamp(1.5rem,5vw,2rem)] leading-tight tracking-[-0.03em]">
            {isComplete
              ? localization.auth.passwordResetSuccessTitle
              : token
                ? localization.auth.passwordResetTitle
                : localization.auth.passwordResetMissingTitle}
          </h2>
          <p className="mt-4 text-sm leading-6 text-cal-muted">
            {isComplete
              ? localization.auth.passwordResetSuccessDescription
              : token
                ? localization.auth.passwordResetDescription
                : localization.auth.passwordResetMissingDescription}
          </p>
          {isComplete ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                onClick={() => {
                  router.push("/login");
                }}
              >
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
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
              <Field
                label={localization.auth.newPassword}
                hint={localization.auth.passwordHint}
              >
                <input
                  className={inputClassName}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                  required
                  minLength={8}
                  disabled={!token}
                />
              </Field>
              {confirmPasswordReset.error ? (
                <ErrorState
                  error={confirmPasswordReset.error}
                  title={localization.auth.passwordResetFailedTitle}
                />
              ) : null}
              <Button
                type="submit"
                size="lg"
                disabled={!token || confirmPasswordReset.isPending}
              >
                {confirmPasswordReset.isPending
                  ? localization.auth.working
                  : localization.auth.passwordResetSubmit}
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
