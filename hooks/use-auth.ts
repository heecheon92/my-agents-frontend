"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type { LoginRequest, SignupRequest } from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

export function useCurrentUser() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.auth.me(),
    queryFn: () => myAgentsAPI.auth.me(),
    retry: false,
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

export function useSignup() {
  return useMutation({
    mutationFn: (payload: SignupRequest) => myAgentsAPI.auth.signup(payload),
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
