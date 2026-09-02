import { describe, expect, it } from "vitest";
import { getAgentProcessDetails } from "@/components/chat/EvidencePanel";
import { formatOperationalSummary } from "@/components/chat/evidence-panel/operational-summary";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";
import {
  agentTraceOperationalSummarySchema,
  agentTraceStepSchema,
  reasoningSummaryDeltaEventDataSchema,
} from "@/model/my-agents";

const step = {
  id: "evidence_judge",
  event_type: "retrieval_completed",
  status: "completed",
  title: { ko: "근거 판정", en: "Evidence Judge" },
  description: { ko: "cross_encoder 관련도 정렬을 적용했습니다.", en: "x" },
  evidence: {},
};

const summary = (key: string, parameters: unknown) => ({
  schema_version: 1,
  message_key: key,
  parameters,
});

const EVERY_KEY = [
  summary("agent_trace.query_planned", {
    retrieval_route: "retrieval_required",
    document_scope: "user_documents",
  }),
  summary("agent_trace.sources_resolved", { resolved_knowledge_base_count: 2 }),
  summary("agent_trace.candidates_found", {
    candidate_count: 12,
    authorized_context_count: 5,
  }),
  summary("agent_trace.relevance_ordered", { candidate_count: 12 }),
  summary("agent_trace.context_prepared", {
    injected_count: 4,
    rejected_count: 8,
    budget_truncated: false,
  }),
  summary("agent_trace.graph_invoked", { retrieved_chunk_count: 4 }),
  summary("agent_trace.answer_prepared", { citation_count: 3 }),
  summary("agent_trace.clarification_requested", {}),
];

describe("operational summary contract", () => {
  it("parses every published message key at version 1", () => {
    for (const item of EVERY_KEY) {
      expect(
        agentTraceOperationalSummarySchema.safeParse(item).success,
        item.message_key,
      ).toBe(true);
    }
  });

  /*
   * Degrading has to cost the caption and nothing else: the step is the
   * verified record and the answer rides on the same response.
   */
  it.each([
    ["an unknown future key", summary("agent_trace.invented", {})],
    [
      "a future version of a known key",
      {
        ...summary("agent_trace.answer_prepared", { citation_count: 1 }),
        schema_version: 2,
      },
    ],
    [
      "parameters that do not match the key",
      summary("agent_trace.answer_prepared", { candidate_count: 1 }),
    ],
    ["a non-object", "agent_trace.answer_prepared"],
  ])("drops %s without dropping the step", (_label, operational_summary) => {
    const parsed = agentTraceStepSchema.parse({ ...step, operational_summary });

    expect(parsed.operational_summary).toBeNull();
    expect(parsed.id).toBe("evidence_judge");
    expect(parsed.status).toBe("completed");
  });

  it("treats an absent summary as absent rather than a parse failure", () => {
    expect(agentTraceStepSchema.parse(step).operational_summary).toBeNull();
  });
});

describe("operational summary copy", () => {
  it("states every key in both locales", () => {
    for (const item of EVERY_KEY) {
      const parsed = agentTraceOperationalSummarySchema.parse(item);
      for (const localization of [ko.chat, en.chat]) {
        const text = formatOperationalSummary(parsed, localization as never);
        expect(text, item.message_key).toBeTruthy();
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("renders counts from the served parameters", () => {
    const parsed = agentTraceOperationalSummarySchema.parse(EVERY_KEY[2]);

    expect(formatOperationalSummary(parsed, ko.chat as never)).toBe(
      "후보 12개 중 권한이 있는 5개를 확인했습니다.",
    );
  });

  it("branches the context summary on the truncation flag", () => {
    const truncated = agentTraceOperationalSummarySchema.parse(
      summary("agent_trace.context_prepared", {
        injected_count: 4,
        rejected_count: 8,
        budget_truncated: true,
      }),
    );
    const plain = agentTraceOperationalSummarySchema.parse(EVERY_KEY[4]);

    expect(formatOperationalSummary(truncated, ko.chat as never)).not.toBe(
      formatOperationalSummary(plain, ko.chat as never),
    );
    expect(formatOperationalSummary(truncated, ko.chat as never)).toContain(
      "분량 제한",
    );
  });

  /*
   * The contract exists so the frontend owns the sentence. A raw enum reaching
   * display text is the exact failure it replaced — an interpolated reranker
   * name did precisely that through free-form `description` prose.
   */
  it("never prints a raw parameter identifier", () => {
    for (const item of EVERY_KEY) {
      const parsed = agentTraceOperationalSummarySchema.parse(item);
      for (const localization of [ko.chat, en.chat]) {
        const text =
          formatOperationalSummary(parsed, localization as never) ?? "";
        expect(text).not.toMatch(/_[a-z]/);
        expect(text).not.toMatch(/cross_encoder|deterministic/);
      }
    }
  });

  it("says nothing when an enum value has no label", () => {
    const unlabelled = {
      schema_version: 1,
      message_key: "agent_trace.query_planned",
      parameters: {
        retrieval_route: "invented_route",
        document_scope: "user_documents",
      },
    } as never;

    expect(formatOperationalSummary(unlabelled, ko.chat as never)).toBeNull();
  });
});

describe("the verified step surface prefers the operational summary", () => {
  const eventWith = (operational_summary?: unknown) => [
    {
      id: "e1",
      run_id: "run-1",
      sequence: 1,
      event_type: "retrieval_completed",
      payload: {
        agent_trace: [
          operational_summary === undefined
            ? step
            : { ...step, operational_summary },
        ],
      },
    },
  ];

  it("replaces backend prose, which is how a raw enum reached the reader", () => {
    const [detail] = getAgentProcessDetails({
      events: eventWith(
        summary("agent_trace.relevance_ordered", { candidate_count: 12 }),
      ) as never,
      lang: "ko",
      localization: ko.chat as never,
    });

    expect(detail.description).toBe("후보 12개를 관련도 순으로 정렬했습니다.");
    expect(detail.description).not.toContain("cross_encoder");
  });

  it("falls back to backend prose for a run that predates the contract", () => {
    const [detail] = getAgentProcessDetails({
      events: eventWith() as never,
      lang: "ko",
      localization: ko.chat as never,
    });

    expect(detail.description).toBe(
      "cross_encoder 관련도 정렬을 적용했습니다.",
    );
  });

  it("falls back when the summary is an unknown key", () => {
    const [detail] = getAgentProcessDetails({
      events: eventWith(summary("agent_trace.invented", {})) as never,
      lang: "ko",
      localization: ko.chat as never,
    });

    expect(detail.description).toBe(
      "cross_encoder 관련도 정렬을 적용했습니다.",
    );
  });

  it("keeps the verified stage title untouched", () => {
    const [detail] = getAgentProcessDetails({
      events: eventWith(
        summary("agent_trace.relevance_ordered", { candidate_count: 12 }),
      ) as never,
      lang: "ko",
      localization: ko.chat as never,
    });

    expect(detail.title).toBe("근거 판정");
    expect(detail.status).toBe("completed");
  });
});

/*
 * Published as an OpenAPI extension on the run, resume, and replay stream
 * operations, so the shape is contract-backed rather than inferred. Tightening
 * is only safe because a rejected delta is dropped, never thrown.
 */
describe("reasoning summary delta matches the published SSE extension", () => {
  it("accepts the published shape", () => {
    expect(
      reasoningSummaryDeltaEventDataSchema.parse({
        stage: "answer_synthesis",
        delta: "I compared the evidence.",
        sequence: 1,
      }),
    ).toEqual({
      stage: "answer_synthesis",
      delta: "I compared the evidence.",
      sequence: 1,
    });
  });

  it.each([
    ["a blank delta", { stage: "answer_synthesis", delta: "", sequence: 1 }],
    ["a zero sequence", { stage: "answer_synthesis", delta: "x", sequence: 0 }],
    ["a missing sequence", { stage: "answer_synthesis", delta: "x" }],
    ["an unknown stage", { stage: "invented", delta: "x", sequence: 1 }],
  ])("rejects %s", (_label, payload) => {
    expect(
      reasoningSummaryDeltaEventDataSchema.safeParse(payload).success,
    ).toBe(false);
  });

  it("accepts an added field rather than dropping the delta over it", () => {
    expect(
      reasoningSummaryDeltaEventDataSchema.safeParse({
        stage: "answer_synthesis",
        delta: "x",
        sequence: 1,
        added_later: true,
      }).success,
    ).toBe(true);
  });
});
