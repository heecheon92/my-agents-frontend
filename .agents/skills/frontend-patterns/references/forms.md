# Forms

## When to use

Use this pattern for a focused client-side form whose validation is known before
submission and whose save operation is injected by the product boundary. Native
`<form>` submission preserves Enter-key behavior; React Hook Form (RHF) owns
field state, and Zod expresses the same payload constraints the service must
recheck authoritatively.

The example is intentionally a simple creation form. It does not require an
editable-detail query or fresh-detail hydration because there is no existing
server record to authorize or hydrate.

## Do not use

- Do not infer authorization, uniqueness, or server acceptance from client Zod
  success. The injected save operation must enforce those rules again.
- Do not replace native submit with a button click handler.
- Do not navigate, close an overlay, clear the form, or show success before the
  save operation confirms success.
- Do not use this creation example for an edit whose payload depends on fresh,
  authoritative detail. Gate that editor and its mutation separately.
- Do not hardcode labels, validation messages, or status text in a reusable
  component.

## Required product decisions

Before adoption, the product must decide:

- create versus edit, and for edit, which authoritative read hydrates the draft;
- required/optional fields, trimming policy, length/range rules, and whether
  whitespace-only input is empty;
- the canonical server validation and authorization behavior;
- how service failure codes map to localized copy;
- whether confirmed success retains, resets, closes, or navigates away from the
  form;
- whether a dirty form needs cancellation or leave-page protection.

The 1–80 character trimmed name rule and failure codes below are example-only
contracts, not product defaults. Verify installed React, RHF, Zod, resolver,
and UI primitive versions and aliases before adapting this stack; the
`useActionState` alternative requires a React/Next.js version that supports it.

## Stable guarantees

- Labels are associated with controls; active validation and server failures
  are announced and referenced with `aria-describedby`.
- Enter submits through the native form.
- An immediate ref lock plus disabled pending controls prevents duplicate saves,
  including two submits before React paints pending state. The field cannot
  change while the submitted value is in flight.
- Client validation prevents an invalid save call, but the service remains the
  authority.
- Failure stays in context. Success causes no invented navigation or overlay
  behavior.
- All user-facing copy and the async save operation are supplied.

## Complete example

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FormEvent, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const nameFormSchema = z.object({
  displayName: z.string().trim().min(1, "required").max(80, "tooLong"),
});

export type NameFormValues = {
  displayName: string;
};

export type NameSaveResult =
  | { ok: true }
  | { ok: false; reason: "conflict" | "unavailable" };

export type NameFormCopy = {
  label: string;
  placeholder: string;
  submit: string;
  submitting: string;
  success: string;
  validation: {
    required: string;
    tooLong: string;
  };
  saveErrors: {
    conflict: string;
    unavailable: string;
    unexpected: string;
  };
};

export type NameFormProps = {
  copy: NameFormCopy;
  saveAction: (values: NameFormValues) => Promise<NameSaveResult>;
};

export function NameForm({ copy, saveAction }: NameFormProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const submittingRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<NameFormValues>({
    defaultValues: { displayName: "" },
    resolver: zodResolver(nameFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const displayName = register("displayName");
  const fieldError =
    errors.displayName?.message === "tooLong"
      ? copy.validation.tooLong
      : errors.displayName
        ? copy.validation.required
        : undefined;
  const serverError = errors.root?.server?.message;

  const submitValidated = handleSubmit(async (values) => {
    setSaved(false);
    clearErrors("root.server");

    try {
      const result = await saveAction(values);
      if (result.ok) {
        setSaved(true);
        return;
      }
      setError("root.server", {
        type: "server",
        message: copy.saveErrors[result.reason],
      });
    } catch {
      setError("root.server", {
        type: "server",
        message: copy.saveErrors.unexpected,
      });
    }
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    void submitValidated(event).finally(() => {
      submittingRef.current = false;
    });
  };

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={fieldId}>{copy.label}</Label>
        <Input
          {...displayName}
          id={fieldId}
          type="text"
          disabled={isSubmitting}
          placeholder={copy.placeholder}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? errorId : undefined}
          onChange={(event) => {
            void displayName.onChange(event);
            clearErrors("root.server");
            setSaved(false);
          }}
        />
        {fieldError ? (
          <p id={errorId} role="alert" className="text-destructive text-sm">
            {fieldError}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      ) : null}
      {saved ? <p role="status">{copy.success}</p> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}
```

`saveAction` may be a Server Action (the prop name follows Next.js conventions)
or a client-side service adapter. In either case it must repeat validation and
perform authorization at the trusted boundary. Keep the example result union
only if its failure vocabulary matches the real service.

## Alternatives

- Use native HTML constraints alone for a small form when their validation and
  message behavior meets the product contract.
- Use a Server Action with `useActionState` when progressive enhancement and
  server-owned validation state matter more than RHF field behavior.
- For authoritative edits, open the surface immediately but hydrate once from
  the required fresh read; do not apply that complexity to simple creation.

## Verification

Main verification should mount `NameForm` with supplied copy and a controllable
`saveAction`, then confirm:

- blank, whitespace-only, and over-80-character values show associated errors
  and never call the service;
- a valid value is trimmed before the service receives it;
- Enter submits exactly as the submit button does;
- a pending save disables the field and submit, and rapid duplicate submission
  calls once;
- each typed failure reason and a rejected promise show supplied in-context
  error copy without success;
- confirmed success announces supplied success copy and does not navigate;
- changing the field clears stale server/success state.
