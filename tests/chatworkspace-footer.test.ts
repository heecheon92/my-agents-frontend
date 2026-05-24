import { describe, expect, it } from "vitest";
import {
  CHAT_SCROLL_REGION_CLASS_NAME,
  CHAT_WORKSPACE_PANEL_CLASS_NAME,
  getLatestAssistantMessageId,
  getNextConversationIdAfterDelete,
} from "@/components/keymesh/ChatWorkspace";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";
import type { Message } from "@/model/my-agents";

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
    expect(en.chat.deleteConversationAction).toBe("Delete");
    expect(ko.chat.deleteConversationAction).toBe("삭제");
    expect(en.chat.deleteConversationConfirm).toContain(
      "conversation and all messages",
    );
    expect(ko.chat.deleteConversationConfirm).toContain("모든 메시지");
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
