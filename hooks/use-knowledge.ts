"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  DocumentCreateRequest,
  DocumentPermissionPatchRequest,
  KnowledgeBaseCreateRequest,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

export function useKnowledgeBases() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
    queryFn: () => myAgentsAPI.knowledgeBases.list(),
  });
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KnowledgeBaseCreateRequest) =>
      myAgentsAPI.knowledgeBases.create(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
      }),
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.documents.list(),
    queryFn: () => myAgentsAPI.documents.list(),
  });
}

export function useDocument(documentId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.documents.detail(documentId ?? ""),
    queryFn: () => myAgentsAPI.documents.detail(documentId ?? ""),
    enabled: Boolean(documentId),
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DocumentCreateRequest) =>
      myAgentsAPI.documents.create(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.documents.list(),
      }),
  });
}

export function useExtractionRuns(documentId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.documents.extractionRuns(documentId ?? ""),
    queryFn: () => myAgentsAPI.documents.extractionRuns(documentId ?? ""),
    enabled: Boolean(documentId),
  });
}

export function useIngestDocument(documentId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAgentsAPI.documents.ingest(documentId ?? ""),
    onSuccess: () => {
      if (documentId) {
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.documents.extractionRuns(documentId),
        });
      }
    },
  });
}

export function usePatchDocumentPermission(documentId?: string) {
  return useMutation({
    mutationFn: (payload: DocumentPermissionPatchRequest) =>
      myAgentsAPI.documents.patchPermission(documentId ?? "", payload),
  });
}
