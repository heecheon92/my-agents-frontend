"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  GroupCreateRequest,
  KnowledgePublishRequestCreateRequest,
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

export function usePublishRequests(groupId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.groups.publishRequests(groupId ?? ""),
    queryFn: () => myAgentsAPI.groups.publishRequests(groupId ?? ""),
    enabled: Boolean(groupId),
  });
}

export function useCreatePublishRequest(groupId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KnowledgePublishRequestCreateRequest) =>
      myAgentsAPI.groups.createPublishRequest(groupId ?? "", payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.publishRequests(groupId ?? ""),
      }),
  });
}

export function useApprovePublishRequest(groupId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      myAgentsAPI.groups.approvePublishRequest(groupId ?? "", requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.publishRequests(groupId ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
      });
    },
  });
}

export function useRejectPublishRequest(groupId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      myAgentsAPI.groups.rejectPublishRequest(groupId ?? "", requestId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.publishRequests(groupId ?? ""),
      }),
  });
}
