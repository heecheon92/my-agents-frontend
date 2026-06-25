"use client";

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import type {
  Document,
  DocumentCreateRequest,
  DocumentPermissionPatchRequest,
  DocumentUploadRequest,
  ExtractionRun,
  KnowledgeBase,
  KnowledgeBaseCreateRequest,
  KnowledgeBaseDocumentCreateRequest,
  KnowledgeBaseDocumentUploadRequest,
  KnowledgeBaseUpdateRequest,
} from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";

const ACTIVE_EXTRACTION_REFETCH_INTERVAL_MS = 1000;

type KnowledgeQueryClient = Pick<
  QueryClient,
  "invalidateQueries" | "removeQueries" | "setQueryData"
>;

const knowledgeBaseDocumentScopedKey = (knowledgeBaseId: string) =>
  ["my-agents", "knowledge-bases", "documents", knowledgeBaseId] as const;

export function isKnowledgeBaseDocumentPreviewEnabled(
  knowledgeBaseId?: string,
  documentId?: string,
  enabled = true,
) {
  return Boolean(knowledgeBaseId && documentId) && enabled;
}

export function invalidateKnowledgeBaseUpdateState(
  queryClient: KnowledgeQueryClient,
  knowledgeBaseId: string,
  knowledgeBase?: KnowledgeBase,
) {
  if (knowledgeBase) {
    queryClient.setQueryData(
      MyAgentsQueryKeys.knowledgeBases.detail(knowledgeBaseId),
      knowledgeBase,
    );
  }
  queryClient.invalidateQueries({
    queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
  });
  queryClient.invalidateQueries({
    queryKey: MyAgentsQueryKeys.knowledgeBases.detail(knowledgeBaseId),
  });
}

export function removeKnowledgeBaseDeletedState(
  queryClient: KnowledgeQueryClient,
  knowledgeBaseId: string,
) {
  queryClient.setQueryData<KnowledgeBase[]>(
    MyAgentsQueryKeys.knowledgeBases.list(),
    (current) =>
      current?.filter((knowledgeBase) => knowledgeBase.id !== knowledgeBaseId),
  );
  queryClient.invalidateQueries({
    queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
  });
  queryClient.removeQueries({
    queryKey: MyAgentsQueryKeys.knowledgeBases.detail(knowledgeBaseId),
  });
  queryClient.removeQueries({
    queryKey: knowledgeBaseDocumentScopedKey(knowledgeBaseId),
  });
}

function hasActiveExtractionRun(runs: ExtractionRun[] | undefined) {
  return (
    runs?.some((run) => run.status === "pending" || run.status === "running") ??
    false
  );
}

export function useKnowledgeBases() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
    queryFn: () => myAgentsAPI.knowledgeBases.list(),
  });
}

export function useKnowledgeBase(knowledgeBaseId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.knowledgeBases.detail(knowledgeBaseId ?? ""),
    queryFn: () => myAgentsAPI.knowledgeBases.detail(knowledgeBaseId ?? ""),
    enabled: Boolean(knowledgeBaseId),
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

export function useUpdateKnowledgeBase(knowledgeBaseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KnowledgeBaseUpdateRequest) =>
      myAgentsAPI.knowledgeBases.update(knowledgeBaseId ?? "", payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        MyAgentsQueryKeys.knowledgeBases.detail(updated.id),
        updated,
      );
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
      });
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.detail(updated.id),
      });
    },
  });
}

export function useDeleteKnowledgeBase(knowledgeBaseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAgentsAPI.knowledgeBases.remove(knowledgeBaseId ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.list(),
      });
      if (!knowledgeBaseId) return;
      queryClient.removeQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.detail(knowledgeBaseId),
      });
      queryClient.removeQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.documents(knowledgeBaseId),
      });
    },
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.documents.list(),
    queryFn: () => myAgentsAPI.documents.list(),
  });
}

export function useKnowledgeBaseDocuments(knowledgeBaseId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.knowledgeBases.documents(knowledgeBaseId ?? ""),
    queryFn: () =>
      myAgentsAPI.documents.listByKnowledgeBase(knowledgeBaseId ?? ""),
    enabled: Boolean(knowledgeBaseId),
  });
}

export function useKnowledgeBaseDocumentPreview(
  knowledgeBaseId?: string,
  documentId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.knowledgeBases.documentPreview(
      knowledgeBaseId ?? "",
      documentId ?? "",
    ),
    queryFn: () =>
      myAgentsAPI.knowledgeBases.documentPreview(
        knowledgeBaseId ?? "",
        documentId ?? "",
      ),
    enabled: Boolean(knowledgeBaseId && documentId && enabled),
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

export function useCreateKnowledgeBaseDocument(knowledgeBaseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KnowledgeBaseDocumentCreateRequest) =>
      myAgentsAPI.documents.createInKnowledgeBase(
        knowledgeBaseId ?? "",
        payload,
      ),
    onSuccess: () => {
      if (!knowledgeBaseId) return;
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.documents(knowledgeBaseId),
      });
    },
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DocumentUploadRequest) =>
      myAgentsAPI.documents.upload(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.documents.list(),
      }),
  });
}

export function useUploadKnowledgeBaseDocument(knowledgeBaseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KnowledgeBaseDocumentUploadRequest) =>
      myAgentsAPI.documents.uploadToKnowledgeBase(
        knowledgeBaseId ?? "",
        payload,
      ),
    onSuccess: () => {
      if (!knowledgeBaseId) return;
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.documents(knowledgeBaseId),
      });
    },
  });
}

export function useDeleteDocument(documentId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAgentsAPI.documents.remove(documentId ?? ""),
    onSuccess: () => {
      queryClient.setQueryData<Document[]>(
        MyAgentsQueryKeys.documents.list(),
        (current) =>
          documentId && current
            ? current.filter((document) => document.id !== documentId)
            : current,
      );
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.documents.list(),
      });
      if (documentId) {
        queryClient.removeQueries({
          queryKey: MyAgentsQueryKeys.documents.detail(documentId),
        });
        queryClient.removeQueries({
          queryKey: MyAgentsQueryKeys.documents.extractionRuns(documentId),
        });
      }
    },
  });
}

export function useDeleteKnowledgeBaseDocument(
  knowledgeBaseId?: string,
  documentId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAgentsAPI.documents.remove(documentId ?? ""),
    onSuccess: () => {
      if (knowledgeBaseId) {
        queryClient.setQueryData<Document[]>(
          MyAgentsQueryKeys.knowledgeBases.documents(knowledgeBaseId),
          (current) =>
            documentId && current
              ? current.filter((document) => document.id !== documentId)
              : current,
        );
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.knowledgeBases.documents(knowledgeBaseId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.documents.list(),
      });
      if (documentId) {
        queryClient.removeQueries({
          queryKey: MyAgentsQueryKeys.documents.detail(documentId),
        });
        queryClient.removeQueries({
          queryKey: MyAgentsQueryKeys.documents.extractionRuns(documentId),
        });
        if (knowledgeBaseId) {
          queryClient.removeQueries({
            queryKey: MyAgentsQueryKeys.knowledgeBases.extractionRuns(
              knowledgeBaseId,
              documentId,
            ),
          });
          queryClient.removeQueries({
            queryKey: MyAgentsQueryKeys.knowledgeBases.documentPreview(
              knowledgeBaseId,
              documentId,
            ),
          });
        }
      }
    },
  });
}

export function useExtractionRuns(documentId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.documents.extractionRuns(documentId ?? ""),
    queryFn: () => myAgentsAPI.documents.extractionRuns(documentId ?? ""),
    enabled: Boolean(documentId),
    refetchInterval: (query) =>
      hasActiveExtractionRun(query.state.data as ExtractionRun[] | undefined)
        ? ACTIVE_EXTRACTION_REFETCH_INTERVAL_MS
        : false,
  });
}

export function useKnowledgeBaseExtractionRuns(
  knowledgeBaseId?: string,
  documentId?: string,
) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.knowledgeBases.extractionRuns(
      knowledgeBaseId ?? "",
      documentId ?? "",
    ),
    queryFn: () =>
      myAgentsAPI.documents.extractionRunsInKnowledgeBase(
        knowledgeBaseId ?? "",
        documentId ?? "",
      ),
    enabled: Boolean(knowledgeBaseId && documentId),
    refetchInterval: (query) =>
      hasActiveExtractionRun(query.state.data as ExtractionRun[] | undefined)
        ? ACTIVE_EXTRACTION_REFETCH_INTERVAL_MS
        : false,
  });
}

export function useExtractionRun(documentId?: string, runId?: string) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.documents.extractionRun(
      documentId ?? "",
      runId ?? "",
    ),
    queryFn: () =>
      myAgentsAPI.documents.extractionRun(documentId ?? "", runId ?? ""),
    enabled: Boolean(documentId && runId),
  });
}

export function useKnowledgeBaseExtractionRun(
  knowledgeBaseId?: string,
  documentId?: string,
  runId?: string,
) {
  return useQuery({
    queryKey: MyAgentsQueryKeys.knowledgeBases.extractionRun(
      knowledgeBaseId ?? "",
      documentId ?? "",
      runId ?? "",
    ),
    queryFn: () =>
      myAgentsAPI.documents.extractionRunInKnowledgeBase(
        knowledgeBaseId ?? "",
        documentId ?? "",
        runId ?? "",
      ),
    enabled: Boolean(knowledgeBaseId && documentId && runId),
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

export function useIngestKnowledgeBaseDocument(
  knowledgeBaseId?: string,
  documentId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      myAgentsAPI.documents.ingestInKnowledgeBase(
        knowledgeBaseId ?? "",
        documentId ?? "",
      ),
    onSuccess: () => {
      if (knowledgeBaseId && documentId) {
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.knowledgeBases.extractionRuns(
            knowledgeBaseId,
            documentId,
          ),
        });
      }
    },
  });
}

export function useIngestDocumentAsync(documentId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => myAgentsAPI.documents.ingestAsync(documentId ?? ""),
    onSuccess: () => {
      if (documentId) {
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.documents.extractionRuns(documentId),
        });
      }
    },
  });
}

export function useIngestKnowledgeBaseDocumentAsync(
  knowledgeBaseId?: string,
  documentId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      myAgentsAPI.documents.ingestAsyncInKnowledgeBase(
        knowledgeBaseId ?? "",
        documentId ?? "",
      ),
    onSuccess: () => {
      if (knowledgeBaseId && documentId) {
        queryClient.invalidateQueries({
          queryKey: MyAgentsQueryKeys.knowledgeBases.extractionRuns(
            knowledgeBaseId,
            documentId,
          ),
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
