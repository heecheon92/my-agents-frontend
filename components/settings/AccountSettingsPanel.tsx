"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Field, inputClassName } from "@/components/Field";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  useCurrentUser,
  useUpdateNickname,
  useUpdatePassword,
} from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { SettingsPageShell } from "./SettingsPageShell";

export function AccountSettingsPanel() {
  const router = useRouter();
  const user = useCurrentUser();
  const updateNickname = useUpdateNickname();
  const updatePassword = useUpdatePassword();
  const { localization } = useLocalization((state) => ({
    settings: state.localization.settings,
    auth: state.localization.auth,
    status: state.localization.status,
  }));
  const copy = localization.settings;
  const [nickname, setNickname] = useState("");
  const [nicknamePassword, setNicknamePassword] = useState("");
  const [nicknameSuccess, setNicknameSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (user.data?.nickname) setNickname(user.data.nickname);
  }, [user.data?.nickname]);

  const isGuest = Boolean(user.data?.is_guest);
  const accountControlsDisabled = isGuest || user.isLoading;
  const emailLabel = user.data?.email ?? copy.account.guestEmailFallback;

  async function handleNicknameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNicknameSuccess(false);
    try {
      await updateNickname.mutateAsync({
        nickname: nickname.trim(),
        current_password: nicknamePassword,
      });
      setNicknamePassword("");
      setNicknameSuccess(true);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError(copy.account.passwordMismatch);
      return;
    }

    try {
      await updatePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.replace("/login");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <SettingsPageShell
      eyebrow={copy.eyebrow}
      title={copy.account.title}
      description={copy.account.description}
      accountTab={copy.tabs.account}
      experimentalTab={copy.tabs.experimental}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <aside className="cal-card rounded-xl p-5">
          <p className="text-sm font-semibold text-cal-muted">
            {copy.account.summaryEyebrow}
          </p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-cal-ink">
            {user.data?.nickname ?? copy.account.loadingAccount}
          </h2>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3">
              <dt className="font-semibold text-cal-muted">
                {copy.account.emailLabel}
              </dt>
              <dd className="mt-1 break-words text-cal-ink">{emailLabel}</dd>
            </div>
            <div className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3">
              <dt className="font-semibold text-cal-muted">
                {copy.account.accountTypeLabel}
              </dt>
              <dd className="mt-1 text-cal-ink">
                {isGuest
                  ? copy.account.guestAccountLabel
                  : copy.account.registeredAccountLabel}
              </dd>
            </div>
          </dl>
          {isGuest ? (
            <div className="mt-5 rounded-lg border border-cal-warning/25 bg-cal-warning/10 p-4 text-sm leading-6 text-cal-warning">
              <p className="font-semibold">{copy.account.guestDisabledTitle}</p>
              <p className="mt-1">{copy.account.guestDisabledDescription}</p>
            </div>
          ) : null}
        </aside>

        <div className="grid gap-4">
          <form
            onSubmit={handleNicknameSubmit}
            className="cal-card rounded-xl p-5"
          >
            <div>
              <h2 className="font-heading text-xl font-semibold text-cal-ink">
                {copy.account.nicknameTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-cal-muted">
                {copy.account.nicknameDescription}
              </p>
            </div>
            <div className="mt-5 grid gap-4">
              <Field
                label={copy.account.nicknameLabel}
                hint={copy.account.nicknameHint}
              >
                <input
                  className={inputClassName}
                  type="text"
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setNicknameSuccess(false);
                  }}
                  maxLength={40}
                  required
                  disabled={accountControlsDisabled}
                />
              </Field>
              <Field
                label={copy.account.currentPasswordLabel}
                hint={copy.account.currentPasswordHint}
              >
                <input
                  className={inputClassName}
                  type="password"
                  autoComplete="current-password"
                  value={nicknamePassword}
                  onChange={(event) => {
                    setNicknamePassword(event.target.value);
                    setNicknameSuccess(false);
                  }}
                  required
                  disabled={accountControlsDisabled}
                />
              </Field>
              {updateNickname.error ? (
                <ErrorState
                  title={copy.account.nicknameErrorTitle}
                  error={updateNickname.error}
                />
              ) : null}
              {nicknameSuccess ? (
                <output
                  aria-live="polite"
                  className="rounded-lg border border-cal-success/20 bg-cal-success/5 p-4 text-sm text-cal-success"
                >
                  {copy.account.nicknameSuccess}
                </output>
              ) : null}
              <Button
                type="submit"
                disabled={accountControlsDisabled || updateNickname.isPending}
              >
                {updateNickname.isPending
                  ? localization.auth.working
                  : copy.account.nicknameSubmit}
              </Button>
            </div>
          </form>

          <form
            onSubmit={handlePasswordSubmit}
            className="cal-card rounded-xl p-5"
          >
            <div>
              <h2 className="font-heading text-xl font-semibold text-cal-ink">
                {copy.account.passwordTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-cal-muted">
                {copy.account.passwordDescription}
              </p>
            </div>
            <div className="mt-5 grid gap-4">
              <Field label={copy.account.currentPasswordLabel}>
                <input
                  className={inputClassName}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                  }}
                  required
                  disabled={accountControlsDisabled}
                />
              </Field>
              <Field
                label={copy.account.newPasswordLabel}
                hint={copy.account.newPasswordHint}
              >
                <input
                  className={inputClassName}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordError(null);
                  }}
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={accountControlsDisabled}
                />
              </Field>
              <Field label={copy.account.confirmPasswordLabel}>
                <input
                  className={inputClassName}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setPasswordError(null);
                  }}
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={accountControlsDisabled}
                />
              </Field>
              {passwordError ? (
                <ErrorState
                  title={copy.account.passwordErrorTitle}
                  description={passwordError}
                />
              ) : null}
              {updatePassword.error ? (
                <ErrorState
                  title={copy.account.passwordErrorTitle}
                  error={updatePassword.error}
                />
              ) : null}
              <Button
                type="submit"
                variant="destructive"
                disabled={accountControlsDisabled || updatePassword.isPending}
              >
                {updatePassword.isPending
                  ? localization.auth.working
                  : copy.account.passwordSubmit}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </SettingsPageShell>
  );
}
