"use client";

import { useEffect, useRef, useState } from "react";
import { formatFileSize } from "@/components/admin-surfaces/shared";
import { Button } from "@/components/ui/button";
import {
  ATTACHMENT_SELECTION_MAX_CHOICES,
  type AttachmentSelectionInteraction,
} from "@/model/my-agents";
import type { ChatLocalization } from "../types";
import { ExpiryNotice, useIsExpired } from "./DocumentSelectionCard";

/**
 * Which of the conversation's attachments a question meant — up to three.
 *
 * Follows the document card's rules (`docs/durable-interactions.md`): options
 * are the backend's list, rendered as given; Cancel is always reachable, even
 * while resuming or after expiry, because a suspended run blocks the whole
 * conversation; past `expires_at` the answer is disabled locally; and the list
 * is the element that scrolls, so the title and Cancel stay pinned.
 *
 * Checkboxes rather than one-tap buttons, because the answer is a set. The
 * fourth box is disabled rather than silently replacing a choice, which would
 * change the answer without the user asking.
 */
export function AttachmentSelectionCard({
  interaction,
  localization,
  isResuming,
  onSelect,
  onCancel,
}: {
  interaction: AttachmentSelectionInteraction;
  localization: ChatLocalization;
  isResuming: boolean;
  onSelect: (attachmentIds: string[]) => void;
  onCancel: () => void;
}) {
  const isExpired = useIsExpired(interaction.expires_at);
  const canAnswer = !isResuming && !isExpired;
  const [selected, setSelected] = useState<string[]>([]);
  const firstOptionRef = useRef<HTMLInputElement>(null);
  const cancelActionRef = useRef<HTMLButtonElement>(null);
  const atLimit = selected.length >= ATTACHMENT_SELECTION_MAX_CHOICES;
  const anyOriginalExpired = interaction.options.some(
    (option) => !option.original_available,
  );
  /*
   * `original` access reads the file itself, so an option whose original has
   * expired cannot answer and must not be choosable. `notes` access answers
   * from what the conversation retained, so every option stays choosable.
   */
  const notesAccess = interaction.access === "notes";
  const isSelectable = (option: { original_available: boolean }) =>
    notesAccess || option.original_available;
  const firstSelectableIndex = interaction.options.findIndex(isSelectable);
  // Only where names collide: the upload time is what tells two
  // `report.pdf` apart, and elsewhere it is noise.
  const filenameCounts = new Map<string, number>();
  for (const option of interaction.options) {
    filenameCounts.set(
      option.filename,
      (filenameCounts.get(option.filename) ?? 0) + 1,
    );
  }

  // Mounted fresh per question (the slot keys it by `interaction_id`), so
  // the selection starts empty and focus moves into the card once, as the
  // document card does, so a keyboard user is not left behind.
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      (firstOptionRef.current ?? cancelActionRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      data-slot="interaction-card"
      data-interaction-type="attachment_selection"
      className="mb-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-body"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-cal-ink">
          {localization.attachmentInteractionTitle}
        </p>
        {isExpired ? null : (
          <ExpiryNotice
            expiresAt={interaction.expires_at}
            localization={localization}
          />
        )}
      </div>
      <p className="mt-1 text-cal-body">
        {interaction.options.length > 0
          ? localization.attachmentInteractionDescription.replace(
              "{max}",
              String(ATTACHMENT_SELECTION_MAX_CHOICES),
            )
          : localization.attachmentInteractionEmpty}
      </p>

      {interaction.options.length > 0 ? (
        <fieldset
          data-slot="interaction-options"
          className="mt-2 grid max-h-[min(12rem,22dvh)] gap-1 overflow-y-auto"
          disabled={!canAnswer}
        >
          <legend className="sr-only">
            {localization.attachmentInteractionTitle}
          </legend>
          {interaction.options.map((option, index) => {
            const checked = selected.includes(option.attachment_id);
            const selectable = isSelectable(option);
            const showsTime =
              (filenameCounts.get(option.filename) ?? 0) > 1 &&
              option.created_at;
            return (
              <label
                key={option.attachment_id}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-cal-hairline bg-km-surface px-2 py-1.5 has-[:checked]:border-cal-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <input
                  ref={
                    index === firstSelectableIndex ? firstOptionRef : undefined
                  }
                  type="checkbox"
                  className="size-4 shrink-0 accent-cal-primary"
                  checked={checked}
                  disabled={!selectable || (!checked && atLimit)}
                  onChange={() =>
                    setSelected((current) =>
                      checked
                        ? current.filter((id) => id !== option.attachment_id)
                        : [...current, option.attachment_id],
                    )
                  }
                />
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                  <span className="font-medium text-cal-ink">
                    {option.filename}
                  </span>
                  {showsTime ? (
                    <span className="block text-xs text-cal-muted">
                      {localization.attachmentInteractionAttachedAt.replace(
                        "{time}",
                        formatAttachedAt(option.created_at as string),
                      )}
                    </span>
                  ) : null}
                </span>
                {typeof option.byte_size === "number" ? (
                  <span className="shrink-0 text-xs text-cal-muted">
                    {formatFileSize(option.byte_size)}
                  </span>
                ) : null}
                {option.original_available ? null : (
                  <span className="shrink-0 rounded-full bg-cal-surface-soft px-2 py-0.5 text-xs text-cal-muted">
                    {localization.attachmentInteractionOriginalExpired}
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {notesAccess ? (
        <p
          data-slot="attachment-interaction-notes-access"
          className="mt-2 text-xs leading-5 text-cal-muted"
        >
          {localization.attachmentInteractionNotesAccess}
        </p>
      ) : anyOriginalExpired ? (
        <p className="mt-2 text-xs leading-5 text-cal-muted">
          {localization.attachmentInteractionOriginalExpiredHelper}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {interaction.options.length > 0 ? (
          <Button
            type="button"
            size="sm"
            disabled={!canAnswer || selected.length === 0}
            onClick={() => onSelect(selected)}
          >
            {localization.attachmentInteractionSubmit}
          </Button>
        ) : null}
        <Button
          ref={cancelActionRef}
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          {localization.interactionCancel}
        </Button>
        {interaction.options.length > 0 ? (
          <span aria-live="polite" className="text-xs text-cal-muted">
            {localization.attachmentInteractionSelectedCount
              .replace("{count}", String(selected.length))
              .replace("{max}", String(ATTACHMENT_SELECTION_MAX_CHOICES))}
          </span>
        ) : null}
      </div>

      {isExpired ? (
        <p
          data-slot="interaction-expired"
          className="mt-2 text-xs text-cal-muted"
        >
          {localization.interactionExpired}
        </p>
      ) : null}
      {isResuming ? (
        <p className="mt-2 text-xs text-cal-muted">
          {localization.interactionResuming}
        </p>
      ) : null}
    </div>
  );
}

function formatAttachedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
