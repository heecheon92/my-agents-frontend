"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  GroupCreateRequest,
  GroupInvitationAcceptRequest,
  GroupInvitationCreateRequest,
  GroupInvitationSignupRequest,
  GroupInvitationUpdateRequest,
  KnowledgePublishRequestCreateRequest,
  MemberPatchRequest,
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

export function useGroupInvitations(groupId?: string, enabled = true) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.groups.invitations(groupId ?? ""),
    queryFn: () => myAgentsAPI.groups.invitations(groupId ?? ""),
    enabled: Boolean(groupId) && enabled,
  });
}

export function useCreateGroupInvitation(groupId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GroupInvitationCreateRequest) =>
      myAgentsAPI.groups.createInvitation(groupId ?? "", payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.invitations(groupId ?? ""),
      }),
  });
}

export function useUpdateGroupInvitation(
  groupId?: string,
  invitationId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GroupInvitationUpdateRequest) =>
      myAgentsAPI.groups.updateInvitation(
        groupId ?? "",
        invitationId ?? "",
        payload,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.invitations(groupId ?? ""),
      }),
  });
}

export function useResendGroupInvitation(
  groupId?: string,
  invitationId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      myAgentsAPI.groups.resendInvitation(groupId ?? "", invitationId ?? ""),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.invitations(groupId ?? ""),
      }),
  });
}

export function useCancelGroupInvitation(
  groupId?: string,
  invitationId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      myAgentsAPI.groups.cancelInvitation(groupId ?? "", invitationId ?? ""),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.invitations(groupId ?? ""),
      }),
  });
}

export function useAcceptGroupInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GroupInvitationAcceptRequest) =>
      myAgentsAPI.groups.acceptInvitation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.list(),
      });
    },
  });
}

export function useSignupFromGroupInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GroupInvitationSignupRequest) =>
      myAgentsAPI.groups.signupFromInvitation(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(MyAgentsQueryKeys.auth.me(), data.user);
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.list(),
      });
    },
  });
}

export function useGroupMembers(groupId?: string, enabled = true) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.groups.members(groupId ?? ""),
    queryFn: () => myAgentsAPI.groups.members(groupId ?? ""),
    enabled: Boolean(groupId) && enabled,
  });
}

export function useUpdateMember(groupId?: string, userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MemberPatchRequest) =>
      myAgentsAPI.groups.updateMember(groupId ?? "", userId ?? "", payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.groups.members(groupId ?? ""),
      }),
  });
}

export function usePublishRequests(groupId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.groups.publishRequests(groupId ?? ""),
    queryFn: () => myAgentsAPI.groups.publishRequests(groupId ?? ""),
    enabled: Boolean(groupId),
  });
}

export function usePublishRequestSource(
  groupId?: string,
  requestId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.groups.publishRequestSource(
      groupId ?? "",
      requestId ?? "",
    ),
    queryFn: () =>
      myAgentsAPI.groups.publishRequestSource(groupId ?? "", requestId ?? ""),
    enabled: Boolean(groupId) && Boolean(requestId) && enabled,
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
