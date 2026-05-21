"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
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

export function useGuestLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAgentsAPI.auth.continueAsGuest(),
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

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAgentsAPI.auth.logout(),
    onSettled: () => {
      queryClient.clear();
    },
  });
}
