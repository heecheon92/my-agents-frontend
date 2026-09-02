"use client";

import { PaperclipIcon, XIcon } from "lucide-react";
import { useId, useRef } from "react";
import { formatFileSize } from "@/components/admin-surfaces/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationAttachment } from "@/model/my-agents";
import type { ChatLocalization } from "../types";
import { findFormatForFile, producesCertifiedArtifact } from "./staging";
import type { AttachmentComposer } from "./useAttachmentComposer";

/**
 * The composer's temporary-file surface.
 *
 * Renders nothing at all unless the served capability reports both `enabled`
 * and `eligible`. A disabled deployment or an ineligible account must not see
 * a greyed-out button: a visible control implies a request path exists, and
 * the guidance is explicit that none should.
 */
export function AttachmentButton({
  localization,
  composer,
  disabled,
}: {
  localization: ChatLocalization;
  composer: AttachmentComposer;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = localization.attachments;

  if (!composer.available || !composer.capability) return null;

  const { capability } = composer;
  const acceptedTypes = capability.formats
    .filter((format) => format.analysis_supported)
    .flatMap((format) => [
      format.extension.startsWith(".")
        ? format.extension
        : `.${format.extension}`,
      ...format.mime_types,
    ])
    .join(",");

  return (
    <div data-slot="attachment-controls" className="shrink-0">
      <input
        ref={inputRef}
        type="file"
        multiple
        // Built from the served registry, never a hardcoded list. A deployment
        // can verify a new family without a frontend release.
        accept={acceptedTypes}
        className="sr-only"
        onChange={(event) => {
          composer.addFiles(Array.from(event.target.files ?? []));
          // Cleared so re-picking the same file fires `change` again.
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-9 shrink-0 rounded-full"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label={copy.attachAction}
        title={copy.attachDescription}
      >
        <PaperclipIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

/**
 * What this message will carry, plus a collapsed library for managing the rest.
 *
 * Chips rather than a checkbox roster. The roster this replaced made the user
 * maintain a standing list on every turn — permanent furniture above the input
 * that grew with the conversation and included expired rows they could not act
 * on. Every other chat product shows what the current message carries and
 * nothing else, and that is the mental model people arrive with.
 *
 * The chips still persist across turns, which is the deliberate divergence: a
 * reader dissecting one spreadsheet asks six follow-ups about it, and making
 * them re-attach each time would be worse than the roster was. What changed is
 * that carrying a file forward is now a visible chip on the turn it applies to
 * rather than a checkbox they have to keep correct.
 *
 * Carrying forward is never implicit. Each run naming an attachment re-sends
 * the file and can start a provider container, so what is included has to be
 * visible on the turn that spends it.
 */
export function AttachmentPanels({
  localization,
  composer,
  disabled,
}: {
  localization: ChatLocalization;
  composer: AttachmentComposer;
  disabled: boolean;
}) {
  const consentId = useId();
  const copy = localization.attachments;

  if (!composer.available || !composer.capability) return null;
  const { capability } = composer;
  const hasStaged = composer.stagedFiles.length > 0;
  /*
   * Derived from server status, not from the raw selection. A file that
   * expires mid-conversation drops out of the composer on its own and reappears
   * in the library marked expired, instead of sitting here looking ready and
   * failing at send with `attachment_expired`.
   */
  const carriedForward = composer.attachments.filter(
    (attachment) =>
      attachment.status === "available" &&
      composer.selectedIds.includes(attachment.id),
  );
  const hasChips = hasStaged || carriedForward.length > 0;

  return (
    <div data-slot="attachment-panels" className="min-w-0">
      {composer.rejection ? (
        <p role="alert" className="mb-2 text-xs leading-5 text-cal-error">
          {copy.rejections[composer.rejection]}
        </p>
      ) : null}
      {hasChips ? (
        <ul
          data-slot="attachment-chips"
          aria-label={copy.turnListLabel}
          className="mb-2 flex min-w-0 flex-wrap gap-1.5"
        >
          {composer.stagedFiles.map((staged) => (
            <AttachmentChip
              key={staged.id}
              filename={staged.file.name}
              byteSize={staged.file.size}
              badge={
                producesCertifiedArtifact(
                  findFormatForFile(capability, staged.file),
                )
                  ? copy.editableOutput
                  : copy.analysisOnly
              }
              removeLabel={`${copy.removeStaged}: ${staged.file.name}`}
              disabled={disabled}
              onRemove={() => composer.removeStagedFile(staged.id)}
            />
          ))}
          {carriedForward.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              filename={attachment.filename}
              byteSize={attachment.byte_size}
              removeLabel={`${copy.removeFromTurn}: ${attachment.filename}`}
              disabled={disabled}
              onRemove={() => composer.toggleSelected(attachment.id)}
            />
          ))}
        </ul>
      ) : null}
      {hasStaged ? (
        <div
          data-slot="attachment-consent"
          className="mb-2 min-w-0 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3"
        >
          <p className="text-xs leading-5 text-cal-muted">
            {copy.stagedHelper}
          </p>
          {/*
            Per send and never pre-checked. The provider name comes from the
            served capability rather than a literal, so the sentence names
            whoever actually receives the bytes.
          */}
          <label
            htmlFor={consentId}
            className="mt-2 flex min-w-0 items-start gap-2 text-xs leading-5 text-cal-ink"
          >
            <input
              id={consentId}
              type="checkbox"
              className="mt-0.5 size-4 shrink-0"
              checked={composer.consentGiven}
              disabled={disabled}
              onChange={(event) =>
                composer.setConsentGiven(event.target.checked)
              }
            />
            <span className="min-w-0">
              {copy.consentLabel.replace("{provider}", capability.provider)}
              <span className="mt-1 block text-cal-muted">
                {copy.consentDescription}
              </span>
            </span>
          </label>
          {!composer.consentGiven ? (
            <p className="mt-2 text-xs leading-5 text-cal-muted">
              {copy.consentRequired}
            </p>
          ) : null}
          {composer.isUploading ? (
            <p className="mt-2 text-xs leading-5 text-cal-muted">
              {copy.uploading}
            </p>
          ) : null}
          {composer.uploadFailed ? (
            <p role="alert" className="mt-2 text-xs leading-5 text-cal-error">
              {copy.uploadPartialFailed}
            </p>
          ) : null}
        </div>
      ) : null}
      {composer.attachments.length > 0 ? (
        <AttachmentLibrary
          localization={localization}
          composer={composer}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

function AttachmentChip({
  filename,
  byteSize,
  badge,
  removeLabel,
  disabled,
  onRemove,
}: {
  filename: string;
  byteSize: number | null;
  badge?: string;
  removeLabel: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-cal-hairline bg-cal-surface-soft py-1 pr-1 pl-2.5 text-xs">
      <span className="min-w-0 truncate text-cal-ink">{filename}</span>
      {byteSize === null ? null : (
        <span className="shrink-0 text-cal-muted">
          {formatFileSize(byteSize)}
        </span>
      )}
      {badge ? (
        <span className="shrink-0 rounded-md bg-km-surface px-1.5 py-0.5 text-[0.6875rem] text-cal-muted">
          {badge}
        </span>
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-6 shrink-0 rounded-full"
        disabled={disabled}
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <XIcon aria-hidden="true" className="size-3.5" />
      </Button>
    </li>
  );
}

function statusLabel(
  status: ConversationAttachment["status"],
  copy: ChatLocalization["attachments"],
) {
  if (status === "available") return copy.statusAvailable;
  if (status === "expired") return copy.statusExpired;
  return copy.statusDeleted;
}

/**
 * The conversation's files, collapsed.
 *
 * This is management, not composition: statuses, expiry, provider deletion, and
 * re-adding a file to the current turn. It does not belong in the send path,
 * so it stays shut until someone opens it.
 */
function AttachmentLibrary({
  localization,
  composer,
  disabled,
}: {
  localization: ChatLocalization;
  composer: AttachmentComposer;
  disabled: boolean;
}) {
  const copy = localization.attachments;

  return (
    <details
      data-slot="attachment-library"
      className="min-w-0 rounded-xl border border-cal-hairline bg-cal-surface-soft"
    >
      <summary className="flex min-h-9 cursor-pointer list-none items-center px-3 text-xs font-semibold text-cal-ink marker:hidden">
        {copy.manageSummary.replace(
          "{count}",
          String(composer.attachments.length),
        )}
      </summary>
      <ul className="grid gap-1.5 border-t border-cal-hairline p-3">
        {composer.attachments.map((attachment) => {
          const isDeleting = composer.deletingIds.includes(attachment.id);
          const isUsable = attachment.status === "available";
          const inUse = composer.selectedIds.includes(attachment.id);
          return (
            <li
              key={attachment.id}
              data-status={attachment.status}
              className="flex min-w-0 items-center gap-2 text-xs"
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  isUsable ? "text-cal-ink" : "text-cal-muted line-through",
                )}
              >
                {attachment.filename}
              </span>
              <span className="shrink-0 text-cal-muted">
                {formatFileSize(attachment.byte_size)}
              </span>
              <span className="shrink-0 text-cal-muted">
                {isDeleting
                  ? copy.removing
                  : statusLabel(attachment.status, copy)}
              </span>
              {isUsable ? (
                <Button
                  type="button"
                  size="sm"
                  variant={inUse ? "ghost" : "secondary"}
                  className="shrink-0"
                  disabled={disabled || isDeleting || inUse}
                  onClick={() => composer.toggleSelected(attachment.id)}
                >
                  {inUse ? copy.inUse : copy.addToTurn}
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                disabled={disabled || isDeleting}
                onClick={() => void composer.removeAttachment(attachment.id)}
                aria-label={`${copy.removeAttachment}: ${attachment.filename}`}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>
      {composer.attachments.some(
        (attachment) => attachment.status === "expired",
      ) ? (
        <p className="px-3 pb-3 text-xs leading-5 text-cal-muted">
          {copy.expiredHelper}
        </p>
      ) : null}
    </details>
  );
}
