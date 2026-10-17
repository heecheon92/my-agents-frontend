# Single-file upload

## When to use

Use this pattern after the product has chosen an explicit, user-submitted,
single-file flow. Native file selection supplies the `File`; the caller supplies
validation, the asynchronous service, and localized copy. Selection never starts
an upload. A failed service call keeps the selected file available for an
explicit Retry.

The state model below is an **illustrative UI contract**, not a default storage
or backend contract. `upload(file): Promise<void>` means only that the caller's
service decides when this UI may announce success. Verify the target React
version, browser capabilities, aliases, and shared `Input`/`Button` contracts;
these component imports illustrate a project stack, not required dependencies.

## Do not use

- Do not treat `File.type`, an `accept` hint, a filename, or client validation as
  proof of MIME type, safety, authorization, or valid server content.
- Do not invent an endpoint, multipart field name, signed-URL exchange, progress
  percentage, automatic upload, preview, or object URL.
- Do not silently retry or claim success before the supplied service resolves.
- Do not use this single-file state machine for a multiple-file queue.

## Required product decisions

The product must decide allowed files and limits, localized validation messages,
multiple-file behavior, storage and authorization, malware/content inspection,
transport, cancellation, timeout and retry policy, upload-versus-commit
semantics, replacement/deletion behavior, and what authoritative response should
update surrounding data. Server-side enforcement remains required even when the
caller repeats a policy in `validate` for immediate feedback.

The caller also decides whether an `accept` picker hint is useful. If added, it
must mirror product policy for convenience only; it is never enforcement.

## Stable guarantees

- `SingleFileUpload` uses one native file input through the shared `Input` and a
  native form so Enter can submit when focus and platform behavior allow it.
- The caller owns validation, upload behavior, and every user-facing string.
- Validation rejection and service failure use accessible alerts; pending and
  success changes use polite live status.
- Pending disables selection, removal, and duplicate submission.
- A service failure preserves the file and exposes an explicit Retry. Selecting
  a file does not upload it.
- The example creates no preview/object URL and makes no security claim.

## Complete example

```tsx
"use client";

import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FileValidation =
  | { ok: true }
  | { ok: false; message: string };

export type UploadService = {
  upload(file: File): Promise<void>;
};

export type SingleFileUploadCopy = {
  title: string;
  chooseFile: string;
  noFileSelected: string;
  selectedFile(name: string): string;
  upload: string;
  retry: string;
  remove: string;
  uploading: string;
  uploadFailed: string;
  uploadSucceeded(name: string): string;
};

export type SingleFileUploadProps = {
  validate(file: File): FileValidation;
  service: UploadService;
  copy: SingleFileUploadCopy;
};

type UploadState =
  | { status: "idle" }
  | { status: "rejected"; message: string }
  | { status: "ready"; file: File }
  | { status: "pending"; file: File }
  | { status: "failed"; file: File }
  | { status: "succeeded"; file: File };

export function SingleFileUpload({ validate, service, copy }: SingleFileUploadProps) {
  const inputId = useId();
  const feedbackId = `${inputId}-feedback`;
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const submittingRef = useRef(false);
  const isPending = state.status === "pending";
  const selectedFile = "file" in state ? state.file : null;
  const hasValidationError = state.status === "rejected";

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.item(0) ?? null;
    event.currentTarget.value = "";
    if (!file) {
      setState({ status: "idle" });
      return;
    }

    const validation = validate(file);
    if (!validation.ok) {
      setState({ status: "rejected", message: validation.message });
      return;
    }
    setState({ status: "ready", file });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (state.status !== "ready" && state.status !== "failed") return;
    submittingRef.current = true;

    const file = state.file;
    setState({ status: "pending", file });
    try {
      await service.upload(file);
      setState({ status: "succeeded", file });
    } catch {
      setState({ status: "failed", file });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="space-y-4">
      <h1 id={`${inputId}-title`} className="text-xl font-semibold">
        {copy.title}
      </h1>
      <form className="space-y-3" onSubmit={submit}>
        <label className="grid gap-1" htmlFor={inputId}>
          <span className="text-sm font-medium">{copy.chooseFile}</span>
          <Input
            aria-describedby={hasValidationError ? feedbackId : undefined}
            aria-invalid={hasValidationError || undefined}
            disabled={isPending}
            id={inputId}
            onChange={selectFile}
            type="file"
          />
        </label>

        <p className="text-sm">
          {selectedFile
            ? copy.selectedFile(selectedFile.name)
            : copy.noFileSelected}
        </p>

        {state.status === "rejected" ? (
          <p id={feedbackId} role="alert">
            {state.message}
          </p>
        ) : null}
        {state.status === "failed" ? (
          <p id={feedbackId} role="alert">
            {copy.uploadFailed}
          </p>
        ) : null}
        {state.status === "pending" ? (
          <p aria-live="polite">{copy.uploading}</p>
        ) : null}
        {state.status === "succeeded" ? (
          <p aria-live="polite">{copy.uploadSucceeded(state.file.name)}</p>
        ) : null}

        <div className="flex gap-2">
          <Button
            disabled={
              state.status !== "ready" && state.status !== "failed"
            }
            type="submit"
          >
            {state.status === "failed" ? copy.retry : copy.upload}
          </Button>
          <Button
            disabled={isPending || state.status === "idle"}
            onClick={() => setState({ status: "idle" })}
            type="button"
            variant="outline"
          >
            {copy.remove}
          </Button>
        </div>
      </form>
    </section>
  );
}
```

The validator should return caller-localized policy feedback. The service should
translate transport/backend failures into its own observability while this UI
shows safe generic copy. If cancellation becomes an approved requirement, change
the service and state contract deliberately; do not bolt an unused `AbortSignal`
onto this example.

## Alternatives

Use a multiple-file queue only when the product defines per-file and aggregate
limits, ordering, concurrency, partial failure, retry, removal, and commit rules.
Use direct-to-storage or signed uploads only with an approved authorization and
commit protocol. Add a preview only when the workflow requires it and defines
resource cleanup, accessibility, supported formats, and failure behavior. For a
simple form posted as a whole, keep the file in that form instead of introducing
an independent upload lifecycle.

## Verification

Smoke with a caller validator and controllable service: rejecting a file shows
its policy message and performs no upload; selecting a valid file shows its name
but performs no upload; submit enters pending and prevents duplicate submission;
service rejection keeps the filename and exposes Retry; Retry invokes the same
service again and resolved upload announces success once. Verify Remove clears
all visible state, selecting the same file again still fires selection, keyboard
submission works, focus remains usable, and no endpoint request occurs except
through the supplied service. Separately verify the real server rejects unsafe,
unauthorized, oversized, or disallowed content according to its own policy.
