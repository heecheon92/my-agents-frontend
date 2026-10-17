"use client";

import { useState } from "react";
import { useReplayAssistantMessage } from "@/hooks/use-conversations";
import type { ConversationRunResponse } from "@/model/my-agents";
import { isMyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";
import { errorCodeOf, resolveErrorMessage } from "@/utils/error-message";
import type { Localization } from "@/utils/localization";

type ReplayNotice = {
  messageId: string;
  message: string;
  tone: "error" | "success" | "warning";
};

type UseReplayAssistantMessageHandlerOptions = {
  activeId?: string;
  conversationIsBusy: boolean;
  isCancelling: boolean;
  localization: Localization["chat"];
  /** For coded durable failures, which are named by the shared copy table. */
  errorLocalization?: Localization;
  /** Read per regeneration: whether to admit it as a durable run. */
  isDurableEnabled?: () => boolean;
  setStatusAnnouncement: (message: string) => void;
  onReplayStart?: () => void;
  onReplayResult: (result: ConversationRunResponse) => void;
  onReplayError?: () => void;
};

export function useReplayAssistantMessageHandler({
  activeId,
  conversationIsBusy,
  isCancelling,
  localization,
  errorLocalization,
  isDurableEnabled,
  setStatusAnnouncement,
  onReplayStart,
  onReplayResult,
  onReplayError,
}: UseReplayAssistantMessageHandlerOptions) {
  const replayAssistantMessage = useReplayAssistantMessage(
    activeId,
    isDurableEnabled,
  );
  const [replayingMessageId, setReplayingMessageId] = useState<string | null>(
    null,
  );
  const [replayNotice, setReplayNotice] = useState<ReplayNotice | null>(null);

  async function handleReplayAssistantMessage(messageId: string) {
    if (
      !activeId ||
      conversationIsBusy ||
      isCancelling ||
      replayAssistantMessage.isPending
    ) {
      return;
    }

    setReplayingMessageId(messageId);
    setReplayNotice(null);
    onReplayStart?.();
    setStatusAnnouncement(localization.replayStartedAnnouncement);

    try {
      const replayResult = await replayAssistantMessage.mutateAsync(messageId);
      if (!replayResult) {
        // The regenerated answer stopped to ask something. The run list
        // surfaces the question; there is no result to report yet.
        onReplayError?.();
        return;
      }
      onReplayResult(replayResult);
      const hasUnavailableSources = replayResult.warnings.some(
        (warning) => warning.code === "regeneration_sources_unavailable",
      );
      setReplayNotice({
        messageId,
        message: hasUnavailableSources
          ? localization.replaySourcesUnavailable
          : localization.replaySuccess,
        tone: hasUnavailableSources ? "warning" : "success",
      });
      setStatusAnnouncement(
        hasUnavailableSources
          ? localization.replaySourcesUnavailableAnnouncement
          : localization.replaySuccessAnnouncement,
      );
    } catch (error) {
      onReplayError?.();
      const isConflict = isMyAgentsAPIError(error) && error.status === 409;
      // A coded durable failure is named from the copy table, never from its
      // message, which is internal text. Any other path is unchanged.
      const durableCode =
        isDurableEnabled?.() &&
        isMyAgentsAPIError(error) &&
        error.status !== 409
          ? errorCodeOf(error)
          : undefined;
      const message = durableCode
        ? resolveErrorMessage(
            error,
            errorLocalization,
            localization.replayFailed,
          )
        : error instanceof Error
          ? error.message
          : isConflict
            ? localization.replayConflict
            : localization.replayFailed;
      setReplayNotice({
        messageId,
        message: isConflict ? message || localization.replayConflict : message,
        tone: "error",
      });
      setStatusAnnouncement(
        isConflict
          ? localization.replayConflictAnnouncement
          : localization.replayFailedAnnouncement,
      );
    } finally {
      setReplayingMessageId(null);
    }
  }

  return {
    handleReplayAssistantMessage,
    replayAssistantMessage,
    replayNotice,
    replayingMessageId,
    setReplayNotice,
  };
}
