"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useConversationAttachments,
  useDeleteAttachment,
  useDocumentWorkspaceCapability,
  useUploadAttachment,
} from "@/hooks/use-document-workspace";
import type { ConversationAttachment } from "@/model/my-agents";
import { isMyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";
import { errorCodeOf } from "@/utils/error-message";
import {
  classifyUploadFailure,
  combinedBytes,
  findFormatForFile,
  hasStagedImage,
  isDocumentWorkspaceUsable,
  resolveMaxFilesPerRun,
  type StagedFile,
  type StagedFileRejection,
  type UploadFailureKind,
  usableAttachmentIds,
  validateStagedFile,
} from "./staging";

let stagedFileSequence = 0;

/**
 * Owns everything about temporary conversation files in the composer:
 * capability gating, local staging, consent, upload, selection, and removal.
 *
 * Staging is local on purpose. The attachment endpoint needs a conversation
 * ID, and bare `/chat` deliberately creates no conversation until the first
 * message is sent — so on a new chat the files wait in memory, and the send
 * path creates the conversation, uploads, and only then starts the run. No
 * bytes leave the browser before the user consents.
 */
export function useAttachmentComposer({
  conversationId,
}: {
  conversationId?: string;
}) {
  const capabilityQuery = useDocumentWorkspaceCapability();
  const capability = capabilityQuery.data;
  const available = isDocumentWorkspaceUsable(capability);

  const attachmentsQuery = useConversationAttachments(
    available ? conversationId : undefined,
  );
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [rejection, setRejection] = useState<StagedFileRejection | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploadFailed, setUploadFailed] = useState(false);
  /**
   * Why each still-staged file failed its last upload, keyed by staged ID.
   * Kept past the send that produced it: a refused file stays staged, and the
   * reason has to stay next to it until the user removes or replaces it.
   */
  const [uploadFailures, setUploadFailures] = useState<
    Record<string, UploadFailureKind>
  >({});
  /**
   * Rows whose delete is in flight. Kept here rather than derived from the
   * mutation so several deletes can be pending at once, and so the row stays
   * visible — a failed delete can mean the provider still holds the file.
   */
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  const attachments = useMemo<ConversationAttachment[]>(
    () => attachmentsQuery.data ?? [],
    [attachmentsQuery.data],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (!capability) return;
      setUploadFailed(false);
      setStagedFiles((current) => {
        let next = current;
        let firstRejection: StagedFileRejection | null = null;
        for (const file of files) {
          const reason = validateStagedFile({
            file,
            capability,
            staged: next,
          });
          if (reason) {
            firstRejection ??= reason;
            continue;
          }
          stagedFileSequence += 1;
          next = [...next, { id: `staged-${stagedFileSequence}`, file }];
        }
        setRejection(firstRejection);
        return next;
      });
    },
    [capability],
  );

  const removeStagedFile = useCallback((stagedId: string) => {
    setRejection(null);
    setUploadFailed(false);
    setStagedFiles((current) =>
      current.filter((staged) => staged.id !== stagedId),
    );
    setUploadFailures((current) => {
      const { [stagedId]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const toggleSelected = useCallback((attachmentId: string) => {
    setSelectedIds((current) =>
      current.includes(attachmentId)
        ? current.filter((id) => id !== attachmentId)
        : [...current, attachmentId],
    );
  }, []);

  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      if (!conversationId) return;
      setDeletingIds((current) => [...current, attachmentId]);
      try {
        await deleteAttachment.mutateAsync({ conversationId, attachmentId });
        // Dropped from the selection only after the server confirms. Removing
        // it optimistically would tell the user the file is gone while the
        // provider may still hold it.
        setSelectedIds((current) =>
          current.filter((id) => id !== attachmentId),
        );
      } finally {
        setDeletingIds((current) =>
          current.filter((id) => id !== attachmentId),
        );
      }
    },
    [conversationId, deleteAttachment],
  );

  /**
   * Transfers everything staged, then returns the IDs this turn should send.
   *
   * Failures stay staged rather than being discarded: the bytes are still on
   * the user's disk and a retry is the obvious next move. Successes leave the
   * staging list immediately so a second send cannot upload them twice and
   * bill the account twice.
   */
  const uploadStagedFiles = useCallback(
    async (targetConversationId: string) => {
      const pending = stagedFiles;
      if (pending.length === 0) {
        return {
          uploadedIds: [] as string[],
          uploadedAttachments: [] as ConversationAttachment[],
          stagedCount: 0,
        };
      }
      const uploadedIds: string[] = [];
      // Returned whole, not just as IDs: the attachments query has not
      // refetched yet, and the optimistic message needs names to show.
      const uploadedAttachments: ConversationAttachment[] = [];
      const failures: StagedFile[] = [];
      const failureKinds: Record<string, UploadFailureKind> = {};
      for (const staged of pending) {
        try {
          const attachment = await uploadAttachment.mutateAsync({
            conversationId: targetConversationId,
            file: staged.file,
            providerConsent: true,
          });
          uploadedIds.push(attachment.id);
          uploadedAttachments.push(attachment);
        } catch (error) {
          failures.push(staged);
          failureKinds[staged.id] = classifyUploadFailure(
            isMyAgentsAPIError(error) ? errorCodeOf(error) : undefined,
            capability ? findFormatForFile(capability, staged.file) : undefined,
          );
        }
      }
      setStagedFiles(failures);
      setUploadFailures(failureKinds);
      // The generic "try again" line is only for failures a retry can fix;
      // refused files carry their own reason instead.
      setUploadFailed(
        Object.values(failureKinds).some((kind) => kind === "retryable"),
      );
      if (uploadedIds.length > 0) {
        setSelectedIds((current) => [...current, ...uploadedIds]);
        setConsentGiven(false);
      }
      return { uploadedIds, uploadedAttachments, stagedCount: pending.length };
    },
    [capability, stagedFiles, uploadAttachment],
  );

  /** Selection narrowed to what the server still reports as available. */
  const sendableAttachmentIds = useMemo(
    () => usableAttachmentIds(attachments, selectedIds),
    [attachments, selectedIds],
  );

  /**
   * Drops the attachments a run submitted, once the backend has admitted it.
   *
   * Takes the run's own ID list rather than clearing the selection: a queued
   * message carries a snapshot, and by the time it is admitted the composer
   * may hold files chosen for a later turn. The server recalls submitted files
   * for later turns itself, so they no longer need to ride along as chips.
   */
  const recallsSubmittedFiles = Boolean(capability?.automatic_recall_supported);
  const releaseSubmitted = useCallback(
    (attachmentIds: string[]) => {
      // Without server-side recall the next turn only sees what it names, so
      // releasing the chip would silently drop the file from the follow-up.
      if (!recallsSubmittedFiles || attachmentIds.length === 0) return;
      const submitted = new Set(attachmentIds);
      setSelectedIds((current) => current.filter((id) => !submitted.has(id)));
    },
    [recallsSubmittedFiles],
  );

  const clearAfterSend = useCallback(() => {
    setRejection(null);
    setUploadFailed(false);
  }, []);

  return {
    available,
    capability,
    attachments,
    stagedFiles,
    stagedBytes: combinedBytes(stagedFiles),
    maxFilesPerRun: capability ? resolveMaxFilesPerRun(capability) : 0,
    rejection,
    consentGiven,
    uploadFailed,
    uploadFailures,
    stagedImage: capability ? hasStagedImage(capability, stagedFiles) : false,
    deletingIds,
    selectedIds,
    sendableAttachmentIds,
    isUploading: uploadAttachment.isPending,
    addFiles,
    removeStagedFile,
    setConsentGiven,
    toggleSelected,
    removeAttachment,
    uploadStagedFiles,
    releaseSubmitted,
    clearAfterSend,
  };
}

export type AttachmentComposer = ReturnType<typeof useAttachmentComposer>;
