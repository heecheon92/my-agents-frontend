import { describe, expect, it } from "vitest";
import { getLatestAssistantMessageId } from "@/components/keymesh/ChatWorkspace";
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
  });
});
