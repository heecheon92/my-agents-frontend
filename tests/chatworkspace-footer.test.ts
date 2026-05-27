import { describe, expect, it } from "vitest";
import {
  ACTIVE_RUN_STALE_NOTICE_AFTER_MS,
  CHAT_SCROLL_REGION_CLASS_NAME,
  CHAT_WORKSPACE_PANEL_CLASS_NAME,
  getConversationCardClassName,
  getLatestAssistantMessageId,
  getNextConversationIdAfterDelete,
  isActiveAgentRunStatus,
  isConversationRunAlreadyActiveError,
  isObservedActiveRunStale,
  REPLAY_ICON_PENDING_CLASS_NAME,
  sanitizeActivityEventPayload,
} from "@/components/keymesh/ChatWorkspace";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";
import type { Message } from "@/model/my-agents";
import { MyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";

const baseMessage = {
  conversation_id: "conversation-1",
  content: "content",
} satisfies Pick<Message, "conversation_id" | "content">;

describe("ChatWorkspace assistant message footer", () => {
  it("targets run evidence at the latest assistant message", () => {
    const messages: Message[] = [
      { ...baseMessage, id: "user-1", role: "user" },
      { ...baseMessage, id: "assistant-1", role: "assistant" },
      { ...baseMessage, id: "user-2", role: "user" },
      { ...baseMessage, id: "assistant-2", role: "assistant" },
    ];

    expect(getLatestAssistantMessageId(messages)).toBe("assistant-2");
  });

  it("spins the replay icon counter-clockwise while regenerating", () => {
    expect(REPLAY_ICON_PENDING_CLASS_NAME).toBe(
      "animate-[spin_1s_linear_infinite_reverse]",
    );
  });

  it("keeps footer action labels localized, including Korean regenerate copy", () => {
    expect(ko.chat.replayAction).toBe("다시 생성");
    expect(en.chat.messageFooterLabel).toBe("Assistant message actions");
    expect(ko.chat.messageFooterLabel).toBe("어시스턴트 메시지 작업");
    expect(en.chat.viewRunHistory).toBe("View run history");
    expect(ko.chat.viewRunHistory).toBe("실행 기록 보기");
    expect(en.chat.viewActivityEvents).toBe("View activity events");
    expect(ko.chat.viewActivityEvents).toBe("활동 이벤트 보기");
    expect(en.chat.viewLatestCitations).toBe("View latest citations");
    expect(ko.chat.viewLatestCitations).toBe("최신 인용 보기");
    expect(en.chat.replaySourcesUnavailable).toContain(
      "current knowledge only",
    );
    expect(ko.chat.replaySourcesUnavailable).toContain("현재 사용 가능한 지식");
    expect(en.chat.activeRunStale).toContain("interrupted");
    expect(ko.chat.activeRunStale).toContain("중단");
    expect(en.chat.activeRunStaleHelper).toContain("service");
    expect(ko.chat.activeRunStaleHelper).toContain("서버");
    expect(en.chat.runStatuses.cancelling).toBe("cancelling");
    expect(ko.chat.runStatuses.cancelled).toBe("취소됨");
    expect(en.chat.replayFailedAnnouncement).toContain("refreshed");
    expect(ko.chat.replayFailedAnnouncement).toContain("새로고침");
    expect(en.chat.deleteConversationAction).toBe("Delete");
    expect(ko.chat.deleteConversationAction).toBe("삭제");
    expect(en.chat.deleteConversationConfirm).toContain(
      "conversation and all messages",
    );
    expect(ko.chat.deleteConversationConfirm).toContain("모든 메시지");
  });

  it("hides internal route details from activity evidence payloads", () => {
    const sanitized = sanitizeActivityEventPayload({
      route: { label: "general_assistant", explanation: "test" },
      retrieval_route: "retrieval_required",
      handled_by: "personal_assistant_graph",
      route_label: "general_assistant",
      reply: "Visible answer",
      nested: { route: "internal", safe: "kept" },
    });

    expect(JSON.stringify(sanitized)).not.toMatch(
      /route|retrieval_route|handled_by|general_assistant|personal_assistant_graph/,
    );
    expect(sanitized).toEqual({
      reply: "Visible answer",
      nested: { safe: "kept" },
    });
    expect(en.chat.runEvidenceLabel).toBe("Run evidence");
    expect(ko.chat.activityPayloadHidden).toBe("내부 처리 정보는 숨김");
  });

  it("keeps selected conversation contrast stable on hover", () => {
    const activeClassName = getConversationCardClassName(true);
    const inactiveClassName = getConversationCardClassName(false);

    expect(activeClassName).toContain("bg-cal-primary");
    expect(activeClassName).toContain("text-white");
    expect(activeClassName).toContain("hover:bg-cal-primary");
    expect(activeClassName).toContain("hover:text-white");
    expect(activeClassName).not.toContain("hover:bg-cal-surface-soft");
    expect(inactiveClassName).toContain("hover:bg-cal-surface-soft");
  });

  it("selects a stable neighboring conversation after deleting the active one", () => {
    const conversations = [{ id: "first" }, { id: "second" }, { id: "third" }];

    expect(
      getNextConversationIdAfterDelete(conversations, "second", "second"),
    ).toBe("third");
    expect(
      getNextConversationIdAfterDelete(conversations, "third", "third"),
    ).toBe("second");
    expect(
      getNextConversationIdAfterDelete(conversations, "first", "third"),
    ).toBe("third");
    expect(
      getNextConversationIdAfterDelete([{ id: "only" }], "only", "only"),
    ).toBeUndefined();
  });

  it("detects server-active conversation runs for queue fallback", () => {
    expect(isActiveAgentRunStatus("running")).toBe(true);
    expect(isActiveAgentRunStatus("cancelling")).toBe(true);
    expect(isActiveAgentRunStatus("completed")).toBe(false);

    expect(
      isConversationRunAlreadyActiveError(
        new MyAgentsAPIError({
          message: "conflict",
          status: 409,
          detail: "conflict",
          body: { message: "conversation run already active" },
        }),
      ),
    ).toBe(true);
    expect(
      isConversationRunAlreadyActiveError(
        new MyAgentsAPIError({
          message: "conflict",
          status: 409,
          detail: "conflict",
          body: "conversation run already active",
        }),
      ),
    ).toBe(true);
    expect(
      isConversationRunAlreadyActiveError(
        new MyAgentsAPIError({
          message: "other conflict",
          status: 409,
          detail: "other conflict",
        }),
      ),
    ).toBe(false);
  });

  it("detects a repeatedly observed active run as stale for interrupted-run UX", () => {
    const observedAt = 1_000;

    expect(
      isObservedActiveRunStale({
        activeRunId: "run-1",
        observedRunId: "run-1",
        observedAt,
        now: observedAt + ACTIVE_RUN_STALE_NOTICE_AFTER_MS,
      }),
    ).toBe(true);
    expect(
      isObservedActiveRunStale({
        activeRunId: "run-1",
        observedRunId: "run-1",
        observedAt,
        now: observedAt + ACTIVE_RUN_STALE_NOTICE_AFTER_MS - 1,
      }),
    ).toBe(false);
    expect(
      isObservedActiveRunStale({
        activeRunId: "run-2",
        observedRunId: "run-1",
        observedAt,
        now: observedAt + ACTIVE_RUN_STALE_NOTICE_AFTER_MS,
      }),
    ).toBe(false);
  });

  it("keeps the chat transcript viewport-bounded and internally scrollable", () => {
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toContain("h-[calc(100dvh-8rem)]");
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toContain("min-h-0");
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toContain("overflow-hidden");
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toContain("xl:h-full");
    expect(CHAT_SCROLL_REGION_CLASS_NAME).toContain("min-h-0");
    expect(CHAT_SCROLL_REGION_CLASS_NAME).toContain("flex-1");
    expect(CHAT_SCROLL_REGION_CLASS_NAME).toContain("overflow-auto");
  });
});
