"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { useAssistantPreferences } from "@/hooks/use-assistant-model";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDocumentUploadPolicy } from "@/hooks/use-capabilities";
import { useReprocessDocument } from "@/hooks/use-knowledge";
import type { Document, DocumentIngestionMode } from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import type { Localization } from "@/utils/localization";

type OriginalActionsCopy = Pick<
  Localization["admin"]["documents"],
  | "downloadOriginalAction"
  | "downloadOriginalUnavailable"
  | "downloadOriginalErrorTitle"
  | "reprocessTitle"
  | "reprocessDescription"
  | "reprocessAction"
  | "reprocessUnavailable"
  | "reprocessStartedAnnouncement"
  | "reprocessErrorTitle"
  | "ingestionModeLegend"
  | "ingestionModeLabels"
  | "aiAssistedDisclosure"
  | "ingestionLoading"
>;

/**
 * Opens a signed download without keeping it anywhere.
 *
 * The URL is a short-lived credential, so it never enters React state, the
 * address bar, or a log: a detached anchor follows it once and is dropped. The
 * storage response carries `Content-Disposition: attachment`, so the browser
 * saves the file and the page stays where it is.
 */
function followSignedDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener noreferrer";
  anchor.click();
}

/**
 * What can be done with a document's retained original: download it, or
 * prepare the document again from it. Both are unavailable — with the reason
 * shown — when the original was not kept, which is every legacy document.
 */
export function SourceOriginalActions({
  document: activeDocument,
  knowledgeBaseId,
  busy,
  copy,
}: {
  document: Document;
  knowledgeBaseId?: string;
  /** A preparation is already running for this document. */
  busy: boolean;
  copy: OriginalActionsCopy;
}) {
  const isGuest = Boolean(useCurrentUser().data?.is_guest);
  const policy = useDocumentUploadPolicy();
  const preferences = useAssistantPreferences();
  const reprocess = useReprocessDocument(knowledgeBaseId, activeDocument.id);
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modeChoice, setModeChoice] = useState<DocumentIngestionMode | null>(
    null,
  );
  const canChooseAiAssisted = policy.aiAssistedIngestion && !isGuest;
  const savedDefault = preferences.data?.document_ingestion_mode ?? "standard";
  const mode: DocumentIngestionMode =
    modeChoice ??
    (savedDefault === "ai_assisted" && !canChooseAiAssisted
      ? "standard"
      : savedDefault);
  const retained = activeDocument.original_retained;
  /**
   * A finished preparation rewrites the document — its mode, record, and
   * processed time — but only the run list polls while it runs. Refresh the
   * document list once the run ends so the record is not stale.
   */
  const queryClient = useQueryClient();
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy && knowledgeBaseId) {
      void queryClient.invalidateQueries({
        queryKey: MyAgentsQueryKeys.knowledgeBases.documents(knowledgeBaseId),
      });
    }
    wasBusy.current = busy;
  }, [busy, knowledgeBaseId, queryClient]);

  async function handleDownload() {
    setDownloadError(null);
    setIsDownloading(true);
    try {
      const { url } = await myAgentsAPI.documents.originalDownload(
        activeDocument.id,
      );
      followSignedDownload(url);
    } catch (error) {
      setDownloadError(error);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleReprocess() {
    try {
      await reprocess.mutateAsync(
        modeChoice === null ? {} : { ingestion_mode: modeChoice },
      );
      toast.success(copy.reprocessStartedAnnouncement);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <div className="grid gap-4" data-slot="source-original-actions">
      <div className="grid gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleDownload()}
          disabled={!retained || isDownloading}
        >
          {copy.downloadOriginalAction}
        </Button>
        {retained ? null : (
          <p className="text-xs leading-5 text-cal-muted">
            {copy.downloadOriginalUnavailable}
          </p>
        )}
        {downloadError ? (
          <ErrorState
            title={copy.downloadOriginalErrorTitle}
            error={downloadError}
          />
        ) : null}
      </div>

      <section className="grid gap-3 rounded-xl border border-cal-hairline bg-cal-canvas p-4">
        <div className="grid gap-1">
          <h3 className="text-sm font-semibold text-cal-ink">
            {copy.reprocessTitle}
          </h3>
          <p className="text-xs leading-5 text-cal-muted">
            {retained ? copy.reprocessDescription : copy.reprocessUnavailable}
          </p>
        </div>
        {retained && !isGuest ? (
          <ChoiceGroup<DocumentIngestionMode>
            slot="reprocess-ingestion-mode"
            legend={copy.ingestionModeLegend}
            value={mode}
            onChange={setModeChoice}
            disabled={busy || reprocess.isPending}
            options={[
              { value: "standard", label: copy.ingestionModeLabels.standard },
              {
                value: "ai_assisted",
                label: copy.ingestionModeLabels.ai_assisted,
                disabled: !canChooseAiAssisted,
              },
            ]}
          >
            <p className="px-2 text-xs leading-5 text-cal-muted">
              {copy.aiAssistedDisclosure}
            </p>
          </ChoiceGroup>
        ) : null}
        <Button
          type="button"
          onClick={() => void handleReprocess()}
          disabled={!retained || busy || reprocess.isPending}
        >
          {busy || reprocess.isPending
            ? copy.ingestionLoading
            : copy.reprocessAction}
        </Button>
        {reprocess.error ? (
          <ErrorState
            title={copy.reprocessErrorTitle}
            error={reprocess.error}
          />
        ) : null}
      </section>
    </div>
  );
}
