import { describe, expect, it } from "vitest";
import { showsCancelledRunNotice } from "@/components/chat/workspace-helpers";

const cancelled = [{ status: "cancelled" }];
const userLast = [{ role: "user" }];

function notice(
  overrides: Partial<Parameters<typeof showsCancelledRunNotice>[0]> = {},
) {
  return showsCancelledRunNotice({
    runs: cancelled,
    messages: userLast,
    isBusy: false,
    hasPendingInteraction: false,
    ...overrides,
  });
}

describe("showsCancelledRunNotice", () => {
  it("explains the silence after a cancelled run left no answer", () => {
    // The reported gap: cancelling a pending clarification showed the user's
    // message and nothing else, with the only acknowledgement in an aria-live
    // region a sighted reader never sees.
    expect(notice()).toBe(true);
  });

  it("stays quiet while the pending question is still on screen", () => {
    // The card is its own explanation; a notice beside it would be noise.
    expect(notice({ hasPendingInteraction: true })).toBe(false);
  });

  it("stays quiet while a run is in flight", () => {
    // Whatever it would say is about to be replaced by an answer.
    expect(notice({ isBusy: true })).toBe(false);
  });

  it("stays quiet when the cancelled run left a partial answer", () => {
    // An assistant message means the reader has something to look at, so the
    // silence this covers did not happen.
    expect(
      notice({ messages: [{ role: "user" }, { role: "assistant" }] }),
    ).toBe(false);
  });

  it("stays quiet when the newest run completed", () => {
    // Only the newest run matters: an older cancelled run is history the
    // transcript already accounts for.
    expect(
      notice({ runs: [{ status: "completed" }, { status: "cancelled" }] }),
    ).toBe(false);
  });

  it("stays quiet in a conversation with no runs at all", () => {
    expect(notice({ runs: [], messages: [] })).toBe(false);
  });
});
