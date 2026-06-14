"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  AccountNicknameUpdateRequest,
  AccountPasswordUpdateRequest,
  GuestAccessRequest,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  SignupRequest,
  VerifyEmailRequest,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

export function useCurrentUser() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.auth.me(),
    queryFn: () => myAgentsAPI.auth.me(),
    retry: false,
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VerifyEmailRequest) =>
      myAgentsAPI.auth.verifyEmail(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(MyAgentsQueryKeys.auth.me(), user);
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginRequest) => myAgentsAPI.auth.login(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(MyAgentsQueryKeys.auth.me(), data.user);
    },
  });
}

export function useGuestAccessRequest() {
  return useMutation({
    mutationFn: (payload: GuestAccessRequest) =>
      myAgentsAPI.auth.requestGuestAccess(payload),
  });
}

export function useGuestCodeLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => myAgentsAPI.auth.loginGuest(code),
    onSuccess: (data) => {
      queryClient.setQueryData(MyAgentsQueryKeys.auth.me(), data.user);
    },
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (payload: SignupRequest) => myAgentsAPI.auth.signup(payload),
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (payload: PasswordResetRequest) =>
      myAgentsAPI.auth.requestPasswordReset(payload),
  });
}

export function useConfirmPasswordReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PasswordResetConfirmRequest) =>
      myAgentsAPI.auth.confirmPasswordReset(payload),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

export function useUpdateNickname() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountNicknameUpdateRequest) =>
      myAgentsAPI.auth.updateNickname(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(MyAgentsQueryKeys.auth.me(), user);
      return queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.auth.me(),
      });
    },
  });
}

export function useUpdatePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountPasswordUpdateRequest) =>
      myAgentsAPI.auth.updatePassword(payload),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAgentsAPI.auth.logout(),
    onSettled: () => {
      queryClient.clear();
    },
  });
}
