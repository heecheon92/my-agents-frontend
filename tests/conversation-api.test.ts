import { describe, expect, it } from "vitest";
import { buildActiveKnowledgeBaseSelection } from "@/components/ChatWorkspace";
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
      api.streamRun("conversation-1", {
        message: "hello",
        knowledge_base_selection: {
          mode: "selected",
          knowledge_base_ids: ["kb-1", "kb-2"],
        },
      }),
    ).resolves.toBe(response);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/conversations/conversation-1/runs/stream");
    expect(calls[0]?.init).toMatchObject({
      method: "POST",
      body: {
        message: "hello",
        knowledge_base_selection: {
          mode: "selected",
          knowledge_base_ids: ["kb-1", "kb-2"],
        },
      },
      headers: { Accept: "text/event-stream" },
    });
  });

  it("deletes conversations through the backend delete contract", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsConversationAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return null;
      },
      fetchResponse: async () => new Response(),
    });

    await expect(api.delete("conversation-1")).resolves.toBeUndefined();
    expect(calls).toEqual([
      {
        path: "/conversations/conversation-1",
        init: { method: "DELETE" },
      },
    ]);
  });

  it("cancels the active run through the backend interrupt contract", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsConversationAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          run_id: "run-1",
          conversation_id: "conversation-1",
          status: "cancelling",
        };
      },
      fetchResponse: async () => new Response(),
    });

    await expect(api.cancelRun("conversation-1", "run-1")).resolves.toEqual({
      run_id: "run-1",
      conversation_id: "conversation-1",
      status: "cancelling",
    });
    expect(calls).toEqual([
      {
        path: "/conversations/conversation-1/runs/run-1/cancel",
        init: { method: "POST" },
      },
    ]);
  });

  it("sends a V2 refinement through the same resume stream", async () => {
    const response = streamResponse([]);
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsConversationAPI({
      fetch: async () => null,
      fetchResponse: async (path, init) => {
        calls.push({ path, init });
        return response;
      },
    });
    const payload = {
      schema_version: 2 as const,
      interaction_id: "4a0b7c65-7c47-4bb3-9618-51ec95291843",
      type: "document_selection" as const,
      kind: "refine" as const,
      text: " Pydantic Annotated Literal.md ",
    };

    await expect(
      api.streamResumeRun("conversation-1", "run-1", payload),
    ).resolves.toBe(response);
    expect(calls).toEqual([
      {
        path: "/conversations/conversation-1/runs/run-1/resume/stream",
        init: {
          method: "POST",
          body: { ...payload, text: "Pydantic Annotated Literal.md" },
          headers: { Accept: "text/event-stream" },
        },
      },
    ]);
  });

  it("replays assistant messages through the backend replay contract", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsConversationAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return {
          run_id: "run-2",
          conversation_id: "conversation-1",
          reply: "Regenerated answer",
          route: { label: "general_assistant", explanation: "test" },
          handled_by: "personal_assistant_graph",
          knowledge_base_selection: { mode: "all", knowledge_base_ids: [] },
          resolved_knowledge_base_count: 0,
          citations: [],
          warnings: [
            {
              code: "regeneration_sources_unavailable",
              message: "missing source",
              missing_document_ids: ["document-1"],
              missing_source_filenames: [],
            },
          ],
        };
      },
      fetchResponse: async () => new Response(),
    });

    await expect(
      api.replayMessage("conversation-1", "message-1"),
    ).resolves.toMatchObject({
      run_id: "run-2",
      reply: "Regenerated answer",
      warnings: [
        {
          code: "regeneration_sources_unavailable",
          missing_document_ids: ["document-1"],
        },
      ],
    });
    expect(calls).toEqual([
      {
        path: "/conversations/conversation-1/messages/message-1/replay",
        init: { method: "POST" },
      },
    ]);
  });

  it("fetches completed run detail for refresh-safe citations", async () => {
    const calls: string[] = [];
    const api = new MyAgentsConversationAPI({
      fetch: async (path) => {
        calls.push(path);
        return {
          run_id: "run-1",
          conversation_id: "conversation-1",
          reply: "Hello",
          route: { label: "general_assistant", explanation: "test" },
          handled_by: "personal_assistant_graph",
          knowledge_base_selection: {
            mode: "selected",
            knowledge_base_ids: ["kb-1"],
          },
          resolved_knowledge_base_count: 1,
          citations: [
            {
              id: "citation-1",
              document_id: "doc-1",
              knowledge_base_id: "kb-1",
              chunk_id: "chunk-1",
              snippet: "Evidence",
              source_page: 2,
              source_filename: "phase-2.pdf",
            },
          ],
        };
      },
      fetchResponse: async () => new Response(),
    });

    await expect(
      api.runDetail("conversation-1", "run-1"),
    ).resolves.toMatchObject({
      run_id: "run-1",
      conversation_id: "conversation-1",
      reply: "Hello",
      route: { label: "general_assistant", explanation: "test" },
      handled_by: "personal_assistant_graph",
      knowledge_base_selection: {
        mode: "selected",
        knowledge_base_ids: ["kb-1"],
      },
      resolved_knowledge_base_count: 1,
      citations: [
        {
          id: "citation-1",
          document_id: "doc-1",
          knowledge_base_id: "kb-1",
          chunk_id: "chunk-1",
          snippet: "Evidence",
          source_page: 2,
          source_filename: "phase-2.pdf",
        },
      ],
    });
    expect(calls).toEqual(["/conversations/conversation-1/runs/run-1"]);
  });

  it("parses unified source metadata from completed run responses", async () => {
    const api = new MyAgentsConversationAPI({
      fetch: async () => ({
        run_id: "run-group-1",
        conversation_id: "conversation-group-1",
        reply: "Group answer",
        route: { label: "general_assistant", explanation: "test" },
        handled_by: "personal_assistant_graph",
        retrieval_route: "retrieval_required",
        answer_mode: "document_grounded",
        document_scope: "group_documents",
        knowledge_base_selection: { mode: "all", knowledge_base_ids: [] },
        resolved_knowledge_base_ids: ["kb-group-1", "kb-personal-1"],
        resolved_knowledge_base_count: 2,
        citations: [],
      }),
      fetchResponse: async () => new Response(),
    });

    await expect(
      api.run("conversation-group-1", {
        message: "hello",
        knowledge_base_selection: { mode: "all", knowledge_base_ids: [] },
      }),
    ).resolves.toMatchObject({
      resolved_knowledge_base_ids: ["kb-group-1", "kb-personal-1"],
      resolved_knowledge_base_count: 2,
    });
  });

  it("parses answer deltas and the final run_completed event from SSE", async () => {
    const api = new MyAgentsConversationAPI({
      fetch: async () => null,
      fetchResponse: async () =>
        streamResponse([
          'event: run_started\ndata: {"run_id":"run-1","conversation_id":"conversation-1","status":"running","knowledge_base_selection":{"mode":"selected","knowledge_base_ids":["kb-1"]},"resolved_knowledge_base_count":1}\n\n',
          'event: reasoning_summary_delta\ndata: {"stage":"answer_synthesis","delta":"I compared the evidence.","sequence":1}\n\n',
          'event: answer_delta\ndata: {"delta":"Hel","sequence":1}\n\n',
          'event: answer_delta\ndata: {"delta":"lo","sequence":2}\n\n',
          'event: run_completed\ndata: {"run_id":"run-1","conversation_id":"conversation-1","reply":"Hello","route":{"label":"general_assistant","explanation":"test"},"handled_by":"personal_assistant_graph","knowledge_base_selection":{"mode":"selected","knowledge_base_ids":["kb-1"]},"resolved_knowledge_base_count":1,"citations":[]}\n\n',
        ]),
    });

    const events = [];
    for await (const event of api.streamRunEvents("conversation-1", {
      message: "hello",
    })) {
      events.push(event);
    }

    expect(events).toMatchObject([
      {
        event: "run_started",
        data: {
          run_id: "run-1",
          conversation_id: "conversation-1",
          status: "running",
          knowledge_base_selection: {
            mode: "selected",
            knowledge_base_ids: ["kb-1"],
          },
          resolved_knowledge_base_count: 1,
        },
      },
      {
        event: "reasoning_summary_delta",
        data: {
          stage: "answer_synthesis",
          delta: "I compared the evidence.",
          sequence: 1,
        },
      },
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
          knowledge_base_selection: {
            mode: "selected",
            knowledge_base_ids: ["kb-1"],
          },
          resolved_knowledge_base_ids: [],
          resolved_knowledge_base_count: 1,
          citations: [],
        },
      },
    ]);
  });

  it("parses run_cancelled events for interrupt-safe steering", async () => {
    const api = new MyAgentsConversationAPI({
      fetch: async () => null,
      fetchResponse: async () =>
        streamResponse([
          'event: run_started\ndata: {"run_id":"run-1","conversation_id":"conversation-1","status":"running"}\n\n',
          'event: run_cancelled\ndata: {"run_id":"run-1","conversation_id":"conversation-1","status":"cancelled","partial_reply_persisted":false}\n\n',
        ]),
    });

    const events = [];
    for await (const event of api.streamRunEvents("conversation-1", {
      message: "hello",
    })) {
      events.push(event);
    }

    expect(events).toMatchObject([
      {
        event: "run_started",
        data: {
          run_id: "run-1",
          conversation_id: "conversation-1",
          status: "running",
        },
      },
      {
        event: "run_cancelled",
        data: {
          run_id: "run-1",
          conversation_id: "conversation-1",
          status: "cancelled",
          partial_reply_persisted: false,
        },
      },
    ]);
  });
});

describe("knowledge source selection", () => {
  it("uses the selected knowledge spaces without group/private branching", () => {
    expect(
      buildActiveKnowledgeBaseSelection({
        knowledgeBaseMode: "selected",
        selectedKnowledgeBaseIds: ["kb-personal", "kb-group"],
      }),
    ).toEqual({
      mode: "selected",
      knowledge_base_ids: ["kb-personal", "kb-group"],
    });
  });

  it("uses backend-authorized all mode without explicit ids", () => {
    expect(
      buildActiveKnowledgeBaseSelection({
        knowledgeBaseMode: "all",
        selectedKnowledgeBaseIds: ["kb-ignored"],
      }),
    ).toEqual({ mode: "all", knowledge_base_ids: [] });
  });
});
