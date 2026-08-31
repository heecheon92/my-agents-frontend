"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatLocalization } from "./types";

type CopyState = "idle" | "copied" | "failed";

/** Long enough to read the confirmation, short enough not to look stuck. */
const RESET_AFTER_MS = 2000;

export function CopyTextButton({
  content,
  actionLabel,
  copiedAnnouncement,
  copyFailedAnnouncement,
  revealOnFailure = false,
  fallbackLabel,
  idleIcon,
  className,
}: {
  content: string;
  actionLabel: string;
  copiedAnnouncement: string;
  copyFailedAnnouncement: string;
  revealOnFailure?: boolean;
  fallbackLabel?: string;
  idleIcon?: ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }
    try {
      // Undefined outside a secure context, so this is a real branch rather
      // than defensive noise — over plain HTTP the whole API is absent.
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(content);
      setState("copied");
    } catch {
      // Reported in the live region below. No toast: the failure is local to
      // this button and a global notification would overstate it.
      setState("failed");
    }
    resetTimeoutRef.current = window.setTimeout(
      () => setState("idle"),
      RESET_AFTER_MS,
    );
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col items-end">
      <Button
        type="button"
        size="icon-lg"
        variant="ghost"
        className={cn("min-h-11 min-w-11", className)}
        onClick={handleCopy}
        // Nothing to copy while the answer is still streaming in.
        disabled={content.trim().length === 0}
        // Deliberately stable, unlike the replay button's label: renaming a
        // control under the pointer makes it read as a different button, and
        // the result is announced separately.
        aria-label={actionLabel}
        title={actionLabel}
      >
        {state === "copied" ? (
          <CheckIcon aria-hidden="true" className="text-cal-success" />
        ) : (
          (idleIcon ?? <CopyIcon aria-hidden="true" />)
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {state === "copied"
          ? copiedAnnouncement
          : state === "failed"
            ? copyFailedAnnouncement
            : ""}
      </span>
      {state === "failed" && revealOnFailure ? (
        <p className="mt-1 max-w-64 text-right text-xs leading-5 text-cal-muted">
          {fallbackLabel ? <span>{fallbackLabel}: </span> : null}
          <code className="break-all font-mono text-cal-ink">{content}</code>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Copies an assistant answer to the clipboard.
 *
 * Its own client component rather than part of `ChatTranscript`: the clipboard
 * and the transient confirmation are the only client-side state in the
 * transcript, and `ChatTranscript` is otherwise free of hooks.
 */
export function CopyMessageButton({
  content,
  localization,
  className,
}: {
  content: string;
  localization: ChatLocalization;
  className?: string;
}) {
  return (
    <CopyTextButton
      content={content}
      actionLabel={localization.copyAction}
      copiedAnnouncement={localization.copiedAnnouncement}
      copyFailedAnnouncement={localization.copyFailedAnnouncement}
      className={className}
    />
  );
}
