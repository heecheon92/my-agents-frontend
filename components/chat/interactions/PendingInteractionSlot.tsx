"use client";

import {
  INTERACTION_SCHEMA_VERSION,
  isAttachmentSelection,
  isDocumentSelection,
  type PendingInteraction,
} from "@/model/my-agents";
import type { ChatLocalization } from "../types";
import { AttachmentSelectionCard } from "./AttachmentSelectionCard";
import { DocumentSelectionCard } from "./DocumentSelectionCard";
import { classifyInteraction, resolveInteractionRenderer } from "./registry";
import { UnsupportedInteractionCard } from "./UnsupportedInteractionCard";
import { useInteractionOptions } from "./useInteractionOptions";

/**
 * The one place a wire `type` becomes a component.
 *
 * The backend's interaction contract names what it needs from the user and
 * never names a widget; this is the frontend half of that boundary. Adding a
 * second interaction type should be an entry in `INTERACTION_RENDERERS` plus a
 * card — no change to the run loop or the composer.
 */
const INTERACTION_RENDERERS = {
  document_selection: DocumentSelectionCard,
  attachment_selection: AttachmentSelectionCard,
} as const;

export function PendingInteractionSlot({
  interaction,
  conversationId,
  runId,
  localization,
  isResuming,
  onChoose,
  onRefine,
  onSelectAttachments,
  onCancel,
}: {
  interaction: PendingInteraction;
  conversationId: string | undefined;
  runId: string | null;
  localization: ChatLocalization;
  isResuming: boolean;
  onChoose: (documentId: string) => void;
  onRefine: (text: string) => void;
  onSelectAttachments: (attachmentIds: string[]) => void;
  onCancel: () => void;
}) {
  const support = classifyInteraction(
    { type: interaction.type, major: interaction.schema_version },
    Object.keys(INTERACTION_RENDERERS),
  );

  // Hooks must run unconditionally, so the options hook is called before the
  // unsupported branches return. It no-ops for a non-document interaction.
  const documentSelection =
    support.support === "supported" && isDocumentSelection(interaction)
      ? interaction
      : null;
  const {
    options,
    hasMore,
    isLoadingMore,
    hasError,
    hasLoadedBroadPage,
    displayOptionCount,
    displayLibraryCount,
    loadMore,
  } = useInteractionOptions({
    conversationId,
    runId,
    interaction: documentSelection,
  });

  // Same three-part support decision as the submit handler: a type this build
  // registers is not enough, the version and shape must match too.
  if (support.support === "supported" && isAttachmentSelection(interaction)) {
    return (
      <AttachmentSelectionCard
        key={interaction.interaction_id}
        interaction={interaction}
        localization={localization}
        isResuming={isResuming}
        onSelect={onSelectAttachments}
        onCancel={onCancel}
      />
    );
  }

  if (support.support !== "supported" || !documentSelection) {
    return (
      <UnsupportedInteractionCard
        reason={
          support.support === "unsupported_version"
            ? "unsupported_version"
            : "unsupported_type"
        }
        localization={localization}
        onCancel={onCancel}
      />
    );
  }

  const Renderer = resolveInteractionRenderer(
    { document_selection: DocumentSelectionCard },
    documentSelection.type,
    DocumentSelectionCard,
  );

  return (
    <Renderer
      interaction={documentSelection}
      options={options}
      localization={localization}
      isResuming={isResuming}
      isLoadingMore={isLoadingMore}
      optionsError={hasError}
      hasLoadedBroadPage={hasLoadedBroadPage}
      displayOptionCount={displayOptionCount}
      displayLibraryCount={displayLibraryCount}
      hasMore={hasMore}
      onChoose={onChoose}
      onRefine={onRefine}
      onLoadMore={loadMore}
      onCancel={onCancel}
    />
  );
}

export { INTERACTION_SCHEMA_VERSION };
