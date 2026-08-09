"use client";

import { AgentMarkdown } from "@/components/AgentMarkdown";
import { ErrorState, Pill } from "@/components/Status";
import type {
  KnowledgePublishRequest,
  KnowledgePublishRequestSourceDocument,
} from "@/model/my-agents";

type PublishReviewLocalization = {
  groups: {
    advancedGroupDetails: string;
    publishReviewExtractedContentHint: string;
    publishReviewFallbackSource: string;
    publishReviewFullContentTitle: string;
    publishReviewNoDocuments: string;
    publishReviewNoPreview: string;
    publishReviewPreviewLabel: string;
    publishReviewSourceLabel: string;
    publishReviewSourceLoading: string;
    publishReviewTargetLabel: string;
  };
};

type PublishSource = {
  source_knowledge_base_name?: string | null;
  documents: KnowledgePublishRequestSourceDocument[];
};

type PublishSourceState = {
  data?: PublishSource;
  isLoading: boolean;
  error: unknown;
};

export function PublishReviewSummary({
  request,
  localization,
  publishRequestSourceLabel,
  publishRequestTargetLabel,
}: {
  request?: KnowledgePublishRequest;
  localization: PublishReviewLocalization;
  publishRequestSourceLabel: (request: KnowledgePublishRequest) => string;
  publishRequestTargetLabel: (request: KnowledgePublishRequest) => string;
}) {
  if (!request) return null;
  return (
    <section className="grid gap-3 rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-cal-muted">
          {localization.groups.publishReviewSourceLabel}
        </p>
        <p className="mt-1 break-words font-medium text-cal-ink">
          {publishRequestSourceLabel(request)}
        </p>
        {request.source_document_filename &&
        request.source_document_filename !== request.source_document_title ? (
          <p className="mt-1 break-words text-xs text-cal-muted">
            {request.source_document_filename}
          </p>
        ) : null}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-cal-muted">
          {localization.groups.publishReviewTargetLabel}
        </p>
        <p className="mt-1 break-words text-cal-ink">
          {publishRequestTargetLabel(request)}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-cal-muted">
          {localization.groups.publishReviewPreviewLabel}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-cal-canvas p-2 text-cal-ink">
          {request.source_document_excerpt ||
            localization.groups.publishReviewNoPreview}
        </p>
      </div>
    </section>
  );
}

function PublishSourceDocument({
  document,
  localization,
}: {
  document: KnowledgePublishRequestSourceDocument;
  localization: PublishReviewLocalization;
}) {
  return (
    <article className="rounded-lg border border-cal-hairline bg-cal-canvas p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-semibold text-cal-ink">
            {document.title}
          </h4>
          <p className="mt-1 break-words text-xs text-cal-muted">
            {document.source_filename ?? document.source_type}
            {document.source_page_count
              ? ` · ${document.source_page_count} pages`
              : ""}
          </p>
        </div>
        <Pill tone="slate">{document.source_type}</Pill>
      </div>
      <div className="mt-3 max-h-96 overflow-auto rounded-md border border-cal-hairline bg-km-surface p-3 text-sm leading-6 text-cal-ink">
        <AgentMarkdown
          content={
            document.content || localization.groups.publishReviewNoPreview
          }
        />
      </div>
    </article>
  );
}

export function PublishSourceViewer({
  source,
  localization,
}: {
  source: PublishSourceState;
  localization: PublishReviewLocalization;
}) {
  if (source.isLoading) {
    return (
      <p className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-muted">
        {localization.groups.publishReviewSourceLoading}
      </p>
    );
  }
  if (source.error) return <ErrorState error={source.error} />;
  if (!source.data) return null;
  return (
    <section className="grid gap-3 rounded-lg border border-cal-hairline bg-cal-surface-soft p-3">
      <div>
        <h3 className="text-sm font-semibold text-cal-ink">
          {localization.groups.publishReviewFullContentTitle}
        </h3>
        <p className="mt-1 text-xs leading-5 text-cal-muted">
          {localization.groups.publishReviewExtractedContentHint}
        </p>
        {source.data.source_knowledge_base_name ? (
          <p className="mt-2 break-words text-sm font-medium text-cal-ink">
            {source.data.source_knowledge_base_name}
          </p>
        ) : null}
      </div>
      {source.data.documents.length > 0 ? (
        <div className="grid gap-3">
          {source.data.documents.map((document) => (
            <PublishSourceDocument
              key={document.id}
              document={document}
              localization={localization}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-cal-canvas p-3 text-sm text-cal-muted">
          {localization.groups.publishReviewNoDocuments}
        </p>
      )}
    </section>
  );
}
