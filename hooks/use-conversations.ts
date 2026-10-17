"use client";

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { awaitDurableCompletion } from "@/components/chat/durable-run";
import { newClientRequestId } from "@/components/chat/workspace-helpers";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  Conversation,
  ConversationCreateRequest,
  ConversationRunRequest,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

export function useConversations() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.conversations.list(),
    queryFn: () => myAgentsAPI.conversations.list(),
  });
}

export function useConversation(conversationId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.conversations.detail(conversationId ?? ""),
    queryFn: () => myAgentsAPI.conversations.detail(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
}

export function putCreatedConversationFirst(
  current: Conversation[] | undefined,
  created: Conversation,
) {
  return [created, ...(current ?? []).filter((item) => item.id !== created.id)];
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConversationCreateRequest) =>
      myAgentsAPI.conversations.create(payload),
    onSuccess: (created) => {
      queryClient.setQueryData<Conversation[]>(
        MyAgentsQueryKeys.conversations.list(),
        (current) => putCreatedConversationFirst(current, created),
      );
      return queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.list(),
      });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      myAgentsAPI.conversations.delete(conversationId),
    onSuccess: async (_data, conversationId) => {
      queryClient.setQueryData<Conversation[]>(
        MyAgentsQueryKeys.conversations.list(),
        (current) => current?.filter((item) => item.id !== conversationId),
      );
      queryClient.removeQueries({
        queryKey: MyAgentsQueryKeys.conversations.detail(conversationId),
      });
      queryClient.removeQueries({
        queryKey: MyAgentsQueryKeys.conversations.messages(conversationId),
      });
      queryClient.removeQueries({
        queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
      });
      await queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.list(),
      });
    },
  });
}

export function useMessages(conversationId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.conversations.messages(conversationId ?? ""),
    queryFn: () => myAgentsAPI.conversations.messages(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
}

export function useRuns(conversationId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.conversations.runs(conversationId ?? ""),
    queryFn: () => myAgentsAPI.conversations.runs(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
}

export function useRunDetail(conversationId?: string, runId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.conversations.run(
      conversationId ?? "",
      runId ?? "",
    ),
    queryFn: () =>
      myAgentsAPI.conversations.runDetail(conversationId ?? "", runId ?? ""),
    enabled: Boolean(conversationId && runId),
  });
}

export function useRunEvents(conversationId?: string, runId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.conversations.events(
      conversationId ?? "",
      runId ?? "",
    ),
    queryFn: () =>
      myAgentsAPI.conversations.events(conversationId ?? "", runId ?? ""),
    enabled: Boolean(conversationId && runId),
  });
}

export function useStreamConversationRun(conversationId?: string) {
  return useMutation({
    mutationFn: (payload: ConversationRunRequest) =>
      myAgentsAPI.conversations.streamRun(conversationId ?? "", payload),
  });
}

export function useRunConversation(conversationId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConversationRunRequest) =>
      myAgentsAPI.conversations.run(conversationId ?? "", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.messages(
          data.conversation_id,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.runs(data.conversation_id),
      });
    },
  });
}

export function invalidateConversationReplayState(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  conversationId: string,
) {
  queryClient.invalidateQueries({
    queryKey: MyAgentsQueryKeys.conversations.messages(conversationId),
  });
  queryClient.invalidateQueries({
    queryKey: MyAgentsQueryKeys.conversations.runs(conversationId),
  });
  queryClient.invalidateQueries({
    queryKey: ["my-agents", "conversations", "run", conversationId],
  });
}

/**
 * Regenerates an answer.
 *
 * `isDurableEnabled` is read per regeneration. When it is true the work is
 * admitted as a durable run and followed to its end, so leaving the page
 * cannot lose it; the result is the same completed response the synchronous
 * route returns, or `null` when the regenerated answer stopped to ask the user
 * something. There is no fallback between the two: with the flag on and no
 * worker ready, admission fails with a coded error.
 */
export function useReplayAssistantMessage(
  conversationId?: string,
  isDurableEnabled: () => boolean = () => false,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => {
      const id = conversationId ?? "";
      if (!isDurableEnabled()) {
        return myAgentsAPI.conversations.replayMessage(id, messageId);
      }
      // One key per regeneration, kept across retries of this same request.
      const clientRequestId = newClientRequestId();
      return awaitDurableCompletion({
        api: myAgentsAPI.conversations,
        conversationId: id,
        admit: () =>
          myAgentsAPI.conversations.replayMessageAsync(id, messageId, {
            client_request_id: clientRequestId,
          }),
      });
    },
    onError: () => {
      if (!conversationId) return;
      invalidateConversationReplayState(queryClient, conversationId);
    },
    onSuccess: (data) => {
      if (!data) {
        // Waiting on a question: the run list carries it from here.
        if (conversationId) {
          invalidateConversationReplayState(queryClient, conversationId);
        }
        return;
      }
      invalidateConversationReplayState(queryClient, data.conversation_id);
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.run(
          data.conversation_id,
          data.run_id,
        ),
      });
    },
  });
}
