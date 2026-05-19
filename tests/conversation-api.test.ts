import { describe, expect, it } from "vitest";
import { MyAgentsConversationAPI } from "@/services/my-agents/MyAgentsConversationAPI";

function streamResponse(chunks: string[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}

describe("MyAgentsConversationAPI", () => {
  it("wires the streamed run endpoint as a raw response", async () => {
    const response = new Response("{}", {
      headers: { "content-type": "application/json" },
    });
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsConversationAPI({
      fetch: async () => null,
      fetchResponse: async (path, init) => {
        calls.push({ path, init });
        return response;
      },
    });

    await expect(
      api.streamRun("conversation-1", { message: "hello" }),
    ).resolves.toBe(response);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/conversations/conversation-1/runs/stream");
    expect(calls[0]?.init).toMatchObject({
      method: "POST",
      body: { message: "hello" },
    });
  });

  it("parses answer deltas and the final run_completed event from SSE", async () => {
    const api = new MyAgentsConversationAPI({
      fetch: async () => null,
      fetchResponse: async () =>
        streamResponse([
          'event: answer_delta\ndata: {"delta":"Hel","sequence":1}\n\n',
          'event: answer_delta\ndata: {"delta":"lo","sequence":2}\n\n',
          'event: run_completed\ndata: {"run_id":"run-1","conversation_id":"conversation-1","reply":"Hello","route":{"label":"general_assistant","explanation":"test"},"handled_by":"personal_assistant_graph","citations":[]}\n\n',
        ]),
    });

    const events = [];
    for await (const event of api.streamRunEvents("conversation-1", {
      message: "hello",
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { event: "answer_delta", data: { delta: "Hel", sequence: 1 } },
      { event: "answer_delta", data: { delta: "lo", sequence: 2 } },
      {
        event: "run_completed",
        data: {
          run_id: "run-1",
          conversation_id: "conversation-1",
          reply: "Hello",
          route: { label: "general_assistant", explanation: "test" },
          handled_by: "personal_assistant_graph",
          citations: [],
        },
      },
    ]);
  });
});
