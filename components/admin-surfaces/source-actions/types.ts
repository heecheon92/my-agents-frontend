import type { Document, ExtractionRun } from "@/model/my-agents";

export type SourceActionDialogType = "preview" | "share" | "ingest" | "delete";

export type SourceActionsLocalization = {
  common: {
    cancel: string;
    chunks: string;
    close: string;
    entities: string;
    knowledgeBasePrefix: string;
    loading: string;
    relationships: string;
  };
  documents: {
    sourcePreviewTitle: string;
    sourcePreviewDescription: string;
    sourcePreviewTab: string;
    sourceAdvancedTab: string;
    sourcePreviewEmptyTitle: string;
    sourcePreviewEmptyDescription: string;
    sourcePreviewErrorTitle: string;
    shareSourceTitle: string;
    shareSourceDescription: string;
    shareSourceAction: string;
    shareSourcePending: string;
    shareSourceSuccess: string;
    shareSourceFailed: string;
    shareTargetGroupLabel: string;
    shareTargetSourceSpaceLabel: string;
    shareNoGroupsDescription: string;
    shareNoTargetSourceSpacesDescription: string;
    advancedDetails: string;
    noSelectedTitle: string;
    noSelectedDescription: string;
    prepareRecoveryTitle: string;
    prepareRecoveryHint: string;
    ingestionLoading: string;
    runIngest: string;
    deleteTitle: string;
    deleteDescription: string;
    deleteButton: string;
    deleteConfirm: string;
    extractionRuns: string;
    noExtractionRunsTitle: string;
    noExtractionRunsDescription: string;
    stageLabel: string;
    stages: Record<string, string>;
    pdfSourcePrefix: string;
    pdfSource: string;
    markdownSourcePrefix: string;
    markdownSource: string;
    uploadedTextSourcePrefix: string;
    uploadedTextSource: string;
    spreadsheetSourcePrefix: string;
    spreadsheetSource: string;
    presentationSourcePrefix: string;
    presentationSource: string;
    wordSourcePrefix: string;
    wordSource: string;
    textSource: string;
    pagesLabel: string;
  };
  groups: { roles: Record<string, string> };
};

export type SourceDocumentMutation = {
  error: unknown;
  isPending: boolean;
};

export type SourceIngestMutation = SourceDocumentMutation & {
  mutateAsync: () => Promise<unknown>;
};

export type SourceDeleteMutation = SourceDocumentMutation;

export type SourceExtractionRuns = {
  data?: ExtractionRun[];
  error?: unknown;
  isLoading?: boolean;
};

export type SourceDocumentContext = {
  activeDocument?: Document;
  activeDocumentId?: string;
  displayKnowledgeBaseId?: string;
};
