"use client";

import type { ExtractionRun, Group, KnowledgeBase } from "@/model/my-agents";
import { SourceDeleteDialog } from "./source-actions/SourceDeleteDialog";
import { SourcePreviewDialog } from "./source-actions/SourcePreviewDialog";
import { SourceReingestDialog } from "./source-actions/SourceReingestDialog";
import { SourceShareDialog } from "./source-actions/SourceShareDialog";
import type {
  SourceActionDialogType,
  SourceActionsLocalization,
  SourceDeleteMutation,
  SourceDocumentContext,
  SourceIngestMutation,
} from "./source-actions/types";

type SourceActionsDialogProps = SourceDocumentContext & {
  action?: SourceActionDialogType;
  activeDocumentHasIngestion: boolean;
  allKnowledgeBases: KnowledgeBase[];
  canShareDocument: boolean;
  deleteDocument: SourceDeleteMutation;
  extractionRuns: { data?: ExtractionRun[] };
  ingest: SourceIngestMutation;
  localization: SourceActionsLocalization;
  onDeleteDocument: () => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  teamGroups: Group[];
};

export function SourceActionsDialog({
  action,
  activeDocument,
  activeDocumentHasIngestion,
  activeDocumentId,
  allKnowledgeBases,
  canShareDocument,
  deleteDocument,
  displayKnowledgeBaseId,
  extractionRuns,
  ingest,
  localization,
  onDeleteDocument,
  onOpenChange,
  open,
  teamGroups,
}: SourceActionsDialogProps) {
  const sharedContext = {
    activeDocument,
    activeDocumentId,
    displayKnowledgeBaseId,
  };

  return (
    <>
      <SourcePreviewDialog
        {...sharedContext}
        localization={localization}
        onOpenChange={onOpenChange}
        open={open && action === "preview"}
      />
      <SourceShareDialog
        {...sharedContext}
        allKnowledgeBases={allKnowledgeBases}
        canShareDocument={canShareDocument}
        localization={localization}
        onOpenChange={onOpenChange}
        open={open && action === "share"}
        teamGroups={teamGroups}
      />
      <SourceReingestDialog
        {...sharedContext}
        activeDocumentHasIngestion={activeDocumentHasIngestion}
        extractionRuns={extractionRuns}
        ingest={ingest}
        localization={localization}
        onOpenChange={onOpenChange}
        open={open && action === "ingest"}
      />
      <SourceDeleteDialog
        {...sharedContext}
        deleteDocument={deleteDocument}
        localization={localization}
        onDeleteDocument={onDeleteDocument}
        onOpenChange={onOpenChange}
        open={open && action === "delete"}
      />
    </>
  );
}
