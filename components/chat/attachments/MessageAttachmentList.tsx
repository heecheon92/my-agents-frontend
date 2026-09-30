import { PaperclipIcon } from "lucide-react";
import { formatFileSize } from "@/components/admin-surfaces/shared";
import type { ConversationAttachment } from "@/model/my-agents";
import type { ChatLocalization } from "../types";

/**
 * The files a user message was sent with, read-only, on the message itself.
 *
 * Server truth (`MessageResponse.attachments`): only files the user explicitly
 * attached to this message, never ones a later run recalled on its own. A
 * lapsed file keeps its row and says so, rather than vanishing from the
 * record of what was asked.
 */
export function MessageAttachmentList({
  attachments,
  localization,
}: {
  attachments: ConversationAttachment[];
  localization: ChatLocalization;
}) {
  if (attachments.length === 0) return null;
  const copy = localization.attachments;
  return (
    <ul
      data-slot="message-attachments"
      aria-label={copy.messageAttachmentsLabel}
      className="mt-2 flex min-w-0 flex-wrap justify-end gap-1.5"
    >
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-cal-hairline bg-cal-surface-soft px-2.5 py-1 text-xs"
        >
          <PaperclipIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-cal-muted"
          />
          <span className="min-w-0 truncate text-cal-ink">
            {attachment.filename}
          </span>
          <span className="shrink-0 text-cal-muted">
            {formatFileSize(attachment.byte_size)}
          </span>
          {attachment.status === "available" ? null : (
            <span className="shrink-0 text-cal-muted">
              {attachment.status === "expired"
                ? copy.statusExpired
                : copy.statusDeleted}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
