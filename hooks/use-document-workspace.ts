"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type { ConversationAttachment } from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

/**
 * Whether temporary conversation files are available to this account.
 *
 * `retry: false` follows `useReasoningCapabilities`: a backend without the
 * document-workspace migration answers 404, and that is a supported state
 * rather than a transient failure. The composer renders no attachment control
 * and every run request omits `attachment_ids`, exactly as today.
 */
export function useDocumentWorkspaceCapability() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.capabilities.documentWorkspace(),
    queryFn: () => myAgentsAPI.capabilities.documentWorkspace(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Server-owned attachment metadata for one conversation.
 *
 * Deliberately not cached for long. Expiry is normal here — provider files
 * lapse after about an hour — so a stale list would keep offering a file the
 * backend will refuse, which is the one failure this feature must not have.
 */
export function useConversationAttachments(conversationId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.conversations.attachments(conversationId ?? ""),
    queryFn: () =>
      myAgentsAPI.documentWorkspace.listAttachments(conversationId as string),
    enabled: Boolean(conversationId),
    staleTime: 0,
  });
}

/**
 * Generated artifacts for one conversation, carrying the `run_id` that made
 * each one. Grouping by that is how a cold load reattaches an artifact to its
 * answer; the run list does not carry them.
 */
export function useConversationArtifacts(conversationId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.conversations.artifacts(conversationId ?? ""),
    queryFn: () =>
      myAgentsAPI.documentWorkspace.listArtifacts(conversationId as string),
    enabled: Boolean(conversationId),
    staleTime: 0,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      conversationId: string;
      file: File;
      providerConsent: boolean;
    }) => myAgentsAPI.documentWorkspace.createAttachment(input),
    onSuccess: (_attachment, { conversationId }) => {
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.attachments(conversationId),
      });
    },
  });
}

/**
 * No optimistic removal.
 *
 * A failed delete can mean the provider still holds the file. Hiding the row
 * before the server confirms would tell the user their data is gone when it is
 * not, which is the one lie this feature cannot afford. The row stays, marked
 * as deleting, until the 204 lands.
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId: string; attachmentId: string }) =>
      myAgentsAPI.documentWorkspace.deleteAttachment(input),
    onSettled: (_data, _error, { conversationId }) => {
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.attachments(conversationId),
      });
    },
  });
}

export type { ConversationAttachment };
