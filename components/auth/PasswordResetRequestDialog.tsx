"use client";

import { useState } from "react";
import { Field, inputClassName } from "@/components/Field";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRequestPasswordReset } from "@/hooks/use-auth";
import type { Localization } from "@/utils/localization";

/**
 * The entry point into `/password-reset`.
 *
 * That route, `MyAgentsAuthAPI.requestPasswordReset`, and
 * `useRequestPasswordReset` all existed already, but nothing in the UI ever
 * called them — so the only way to reach password reset was an email nobody
 * could trigger. This is the missing link, not new backend capability.
 *
 * A Dialog rather than a fourth stacked block on the auth page: it is a short
 * single-field form, which is exactly what the repo's overlay rule assigns to
 * Dialog.
 */
export function PasswordResetRequestDialog({
  localization,
  children,
}: {
  localization: Localization["auth"];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const requestPasswordReset = useRequestPasswordReset();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    // Reset between openings so a previous success does not greet the next user.
    if (!nextOpen) {
      setEmail("");
      setIsSubmitted(false);
      requestPasswordReset.reset();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await requestPasswordReset.mutateAsync({ email });
      setIsSubmitted(true);
    } catch {
      // React Query stores the API error on the mutation; rendered below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localization.passwordResetRequestTitle}</DialogTitle>
          <DialogDescription>
            {localization.passwordResetRequestDescription}
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          // Deliberately does not confirm whether the address has an account,
          // matching how guest access and invitations already behave.
          <output
            aria-live="polite"
            className="rounded-control border border-cal-success/20 bg-cal-success/5 p-4 text-sm leading-6 text-cal-success"
          >
            {localization.passwordResetRequestSentDescription}
          </output>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <Field
              label={localization.email}
              hint={localization.passwordResetRequestHint}
            >
              <input
                className={inputClassName}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            {requestPasswordReset.error ? (
              <ErrorState
                title={localization.passwordResetFailedTitle}
                error={requestPasswordReset.error}
              />
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={requestPasswordReset.isPending}>
                {requestPasswordReset.isPending
                  ? localization.working
                  : localization.passwordResetRequestSubmit}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
