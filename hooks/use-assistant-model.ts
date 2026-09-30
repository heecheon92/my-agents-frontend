"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type { AssistantPreferencesPatchRequest } from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

/**
 * The models this deployment offers. `retry: false` for the same reason as
 * reasoning capabilities: a backend without model selection 404s here, which
 * is a supported state — the picker hides and runs use the server default.
 */
export function useAssistantModelCapabilities() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.capabilities.assistantModels(),
    queryFn: () => myAgentsAPI.capabilities.assistantModels(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** The account's saved model and the model new runs will use. */
export function useAssistantPreferences() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.assistant.preferences(),
    queryFn: () => myAgentsAPI.assistant.getPreferences(),
    retry: false,
  });
}

/**
 * Saves the account's model, then refreshes everything that describes it.
 *
 * Reasoning capabilities describe the *effective* model — its recommended
 * effort and whether it supports Pro — so they are stale the moment the model
 * changes. `onSuccess` returns the refetch, which keeps `isPending` true until
 * both have settled; the composer holds send for that whole window so the
 * next run cannot go out against the previous model's reasoning defaults.
 *
 * Shared by the composer and the settings page through the query cache, so a
 * change in either is reflected in the other without a reload.
 */
export function useUpdateAssistantModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssistantPreferencesPatchRequest) =>
      myAgentsAPI.assistant.updatePreferences(payload),
    onSuccess: (preferences) => {
      queryClient.setQueryData(
        MyAgentsQueryKeys.assistant.preferences(),
        preferences,
      );
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.assistant.preferences(),
        }),
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.capabilities.reasoning(),
        }),
      ]);
    },
  });
}
