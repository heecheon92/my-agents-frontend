"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  GroupCreateRequest,
  MemberPatchRequest,
  MemberUpsertRequest,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

export function useGroups() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.groups.list(),
    queryFn: () => myAgentsAPI.groups.list(),
  });
}

export function useGroup(groupId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.groups.detail(groupId ?? ""),
    queryFn: () => myAgentsAPI.groups.detail(groupId ?? ""),
    enabled: Boolean(groupId),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GroupCreateRequest) =>
      myAgentsAPI.groups.create(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.list(),
      }),
  });
}

export function useAddMember(groupId?: string) {
  return useMutation({
    mutationFn: (payload: MemberUpsertRequest) =>
      myAgentsAPI.groups.addMember(groupId ?? "", payload),
  });
}

export function useUpdateMember(groupId?: string, userId?: string) {
  return useMutation({
    mutationFn: (payload: MemberPatchRequest) =>
      myAgentsAPI.groups.updateMember(groupId ?? "", userId ?? "", payload),
  });
}
