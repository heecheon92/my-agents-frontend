"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type { UserMemorySettingsPatchRequest } from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

export function useMemorySettings() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.memories.settings(),
    queryFn: () => myAgentsAPI.memories.getSettings(),
  });
}

export function useUpdateMemorySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserMemorySettingsPatchRequest) =>
      myAgentsAPI.memories.updateSettings(payload),
    onSuccess: (settings) => {
      queryClient.setQueryData(MyAgentsQueryKeys.memories.settings(), settings);
      return queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.memories.settings(),
      });
    },
  });
}
