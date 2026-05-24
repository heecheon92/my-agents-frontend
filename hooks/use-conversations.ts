"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConversationCreateRequest) =>
      myAgentsAPI.conversations.create(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.list(),
      }),
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

export function useReplayAssistantMessage(conversationId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      myAgentsAPI.conversations.replayMessage(conversationId ?? "", messageId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.messages(
          data.conversation_id,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.runs(data.conversation_id),
      });
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.conversations.run(
          data.conversation_id,
          data.run_id,
        ),
      });
    },
  });
}
