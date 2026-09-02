"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { formatFileSize } from "@/components/admin-surfaces/shared";
import { Button } from "@/components/ui/button";
import type { ConversationArtifact } from "@/model/my-agents";
import { myAgentsAPI } from "@/services/my-agents";
import type { ChatLocalization } from "../types";

/**
 * Files a run produced, shown on the answer that produced them.
 *
 * The list is grouped by `run_id` upstream: `AgentRunSummaryResponse` carries
 * no artifacts, so after a refresh this is the only thing tying a generated
 * file back to its answer.
 */
export function ArtifactList({
  localization,
  artifacts,
  conversationId,
}: {
  localization: ChatLocalization;
  artifacts: ConversationArtifact[];
  conversationId: string;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = localization.artifacts;

  if (artifacts.length === 0) return null;

  async function handleDownload(artifact: ConversationArtifact) {
    setDownloadingId(artifact.id);
    setError(null);
    try {
      const response = await myAgentsAPI.documentWorkspace.downloadArtifact({
        conversationId,
        artifactId: artifact.id,
      });
      const blob = await response.blob();
      // An object URL rather than navigating to the proxy path directly: the
      // fetch carries the session cookie and surfaces a 410 as a localized
      // message, where a plain link would replace the page with an error body.
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = artifact.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      // Mapped from the backend error code, never the raw message: the
      // provider's own text must not reach the reading path.
      const code =
        downloadError &&
        typeof downloadError === "object" &&
        "body" in downloadError
          ? ((downloadError.body as { code?: string } | null)?.code ?? null)
          : null;
      const messages = localization.attachments.errors;
      setError(
        (code && code in messages
          ? messages[code as keyof typeof messages]
          : null) ?? messages.artifact_download_failed,
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section
      data-slot="artifact-list"
      aria-label={copy.title}
      className="mt-3 min-w-0 rounded-lg border border-cal-hairline bg-km-surface/70 p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
        {copy.title}
      </p>
      <ul className="mt-2 grid gap-1.5">
        {artifacts.map((artifact) => {
          const isAvailable = artifact.status === "available";
          return (
            <li
              key={artifact.id}
              data-status={artifact.status}
              className="flex min-w-0 flex-wrap items-center gap-2 text-xs"
            >
              <span className="min-w-0 flex-1 truncate text-cal-ink">
                {artifact.filename}
              </span>
              <span className="shrink-0 text-cal-muted">
                {artifact.byte_size === null
                  ? copy.unknownSize
                  : formatFileSize(artifact.byte_size)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0"
                // Expiry is server state, not a guess from the timestamp: a
                // download offered after the container lapsed fails with a 410
                // the user cannot act on.
                disabled={!isAvailable || downloadingId === artifact.id}
                onClick={() => void handleDownload(artifact)}
              >
                <DownloadIcon aria-hidden="true" className="size-3.5" />
                {downloadingId === artifact.id
                  ? copy.downloading
                  : copy.download}
              </Button>
            </li>
          );
        })}
      </ul>
      {artifacts.some((artifact) => artifact.status !== "available") ? (
        <p className="mt-2 text-xs leading-5 text-cal-muted">
          {copy.expiredHelper}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs leading-5 text-cal-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
