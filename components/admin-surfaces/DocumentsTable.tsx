"use client";

import {
  EyeIcon,
  MoreHorizontalIcon,
  RotateCwIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import { EmptyState, ErrorState, Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Document } from "@/model/my-agents";
import {
  documentMeta,
  documentSourceLabel,
  InlineLoadingIndicator,
} from "./shared";
import type { SourceActionDialogType } from "./source-actions/types";

type DocumentsTableLocalization = {
  common: {
    loading: string;
    emptyListDescription: string;
    knowledgeBasePrefix: string;
  };
  documents: {
    sourceTableSource: string;
    sourceTableType: string;
    sourceTableStatus: string;
    sourceTableDetails: string;
    sourceTableActions: string;
    empty: string;
    openSourceDetails: string;
    ingestionLoading: string;
    sourceReadyStatus: string;
    sourceRowActionsLabel: string;
    sourceRowActions: string;
    sourcePreviewAction: string;
    shareSourceMenuAction: string;
    reingestSourceAction: string;
    deleteSourceMenuAction: string;
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
};

type DocumentsTableProps = {
  documents: {
    data?: Document[];
    isLoading: boolean;
    error: unknown;
  };
  activeDocumentId?: string;
  activeIngestionDocumentIds: Set<string>;
  canReingestDocuments: boolean;
  canShareDocuments: boolean;
  localization: DocumentsTableLocalization;
  onOpenSourceActions: (
    documentId: string,
    action: SourceActionDialogType,
  ) => void;
};

export function DocumentsTable({
  documents,
  activeDocumentId,
  activeIngestionDocumentIds,
  canReingestDocuments,
  canShareDocuments,
  localization,
  onOpenSourceActions,
}: DocumentsTableProps) {
  return (
    <Table className="min-w-[56rem]">
      <TableHeader>
        <TableRow className="border-cal-hairline bg-cal-surface-soft hover:bg-cal-surface-soft">
          <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
            {localization.documents.sourceTableSource}
          </TableHead>
          <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
            {localization.documents.sourceTableType}
          </TableHead>
          <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
            {localization.documents.sourceTableStatus}
          </TableHead>
          <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
            {localization.documents.sourceTableDetails}
          </TableHead>
          <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
            {localization.documents.sourceTableActions}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.isLoading ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={5}
              className="px-4 py-14 text-center text-sm text-cal-muted"
            >
              {localization.common.loading}
            </TableCell>
          </TableRow>
        ) : null}
        {documents.error ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="px-4 py-6 whitespace-normal">
              <ErrorState error={documents.error} />
            </TableCell>
          </TableRow>
        ) : null}
        {!documents.isLoading &&
        !documents.error &&
        (documents.data?.length ?? 0) === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="px-4 py-12 whitespace-normal">
              <EmptyState
                title={localization.documents.empty}
                description={localization.common.emptyListDescription}
              />
            </TableCell>
          </TableRow>
        ) : null}
        {documents.data?.map((document) => {
          const isActive = document.id === activeDocumentId;
          const isPreparing = activeIngestionDocumentIds.has(document.id);

          return (
            <TableRow
              key={document.id}
              data-state={isActive ? "selected" : undefined}
              className={cn(
                "border-cal-hairline bg-white",
                isActive
                  ? "bg-cal-surface-soft/80 hover:bg-cal-surface-soft"
                  : "",
              )}
            >
              <TableCell className="px-4 py-4 whitespace-normal">
                <button
                  type="button"
                  onClick={() => onOpenSourceActions(document.id, "preview")}
                  className="grid min-w-0 gap-1 text-left"
                  aria-label={localization.documents.openSourceDetails.replace(
                    "{title}",
                    document.title,
                  )}
                >
                  <span className="break-words text-[15px] font-semibold leading-6 text-cal-ink">
                    {document.title}
                  </span>
                  <span className="break-all text-xs text-cal-muted">
                    {document.id}
                  </span>
                </button>
              </TableCell>
              <TableCell className="px-4 py-4 whitespace-normal text-sm text-cal-body">
                {documentSourceLabel(document, localization.documents)}
              </TableCell>
              <TableCell className="px-4 py-4 whitespace-nowrap">
                {isPreparing ? (
                  <InlineLoadingIndicator
                    label={localization.documents.ingestionLoading}
                  />
                ) : (
                  <Pill tone="green">
                    {localization.documents.sourceReadyStatus}
                  </Pill>
                )}
              </TableCell>
              <TableCell className="px-4 py-4 whitespace-normal text-sm text-cal-muted">
                {documentMeta(document, localization)}
              </TableCell>
              <TableCell className="px-4 py-4 whitespace-normal">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-cal-muted hover:text-cal-ink"
                        aria-label={localization.documents.sourceRowActionsLabel.replace(
                          "{title}",
                          document.title,
                        )}
                      />
                    }
                  >
                    <MoreHorizontalIcon />
                    <span className="sr-only">
                      {localization.documents.sourceRowActions}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() =>
                        onOpenSourceActions(document.id, "preview")
                      }
                    >
                      <EyeIcon />
                      {localization.documents.sourcePreviewAction}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canShareDocuments}
                      onClick={() => onOpenSourceActions(document.id, "share")}
                    >
                      <Share2Icon />
                      {localization.documents.shareSourceMenuAction}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canReingestDocuments || isPreparing}
                      onClick={() => onOpenSourceActions(document.id, "ingest")}
                    >
                      <RotateCwIcon />
                      {localization.documents.reingestSourceAction}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onOpenSourceActions(document.id, "delete")}
                    >
                      <Trash2Icon />
                      {localization.documents.deleteSourceMenuAction}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
