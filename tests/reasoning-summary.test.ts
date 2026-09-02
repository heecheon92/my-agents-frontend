import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AgentProcessPanel,
  getAgentTraceStageKeys,
} from "@/components/chat/EvidencePanel";
import { ReasoningSummarySection } from "@/components/chat/evidence-panel/ReasoningSummarySection";
import { mergeReasoningSummaryDelta } from "@/components/chat/useChatRunLoop";
import { isReasoningSummaryEventType } from "@/components/chat/workspace-helpers";
import localization from "@/localization/en.json";
import {
  conversationRunResponseSchema,
  reasoningSummarySchema,
} from "@/model/my-agents";

const completedRun = {
  run_id: "run-1",
  conversation_id: "conversation-1",
  reply: "Answer",
  route: { label: "general_assistant", explanation: "test" },
  handled_by: "personal_assistant_graph",
  knowledge_base_selection: { mode: "all", knowledge_base_ids: [] },
  resolved_knowledge_base_count: 0,
  citations: [],
};

function renderSection(summaries: Array<{ stage: string; text: string }>) {
  return renderToStaticMarkup(
    createElement(ReasoningSummarySection, {
      summaries: summaries as never,
      isStreaming: false,
      localization: localization.chat,
    }),
  );
}

describe("reasoning summary contract", () => {
  it("parses the OpenAPI-derived item and completed response list", () => {
    const summary = reasoningSummarySchema.parse({
      stage: "retrieval_planning",
      text: "I chose focused document search.",
      source: "model_generated",
    });
    const result = conversationRunResponseSchema.parse({
      ...completedRun,
      reasoning_summaries: [summary],
    });

    expect(result.reasoning_summaries).toEqual([summary]);
  });

  it("treats an absent list as no explanations rather than a parse failure", () => {
    expect(
      conversationRunResponseSchema.parse(completedRun).reasoning_summaries,
    ).toEqual([]);
  });

  /*
   * The answer is the product; the explanation is a caption on it. Enforcing
   * the served 500-character bound while parsing would let one over-long or
   * malformed summary fail the whole completed-run response, so a run that
   * answered correctly would surface as a failure.
   */
  it("keeps the answer when a summary exceeds the served length bound", () => {
    const result = conversationRunResponseSchema.parse({
      ...completedRun,
      reasoning_summaries: [
        {
          stage: "answer_synthesis",
          text: "x".repeat(640),
          source: "provider_reasoning_summary",
        },
      ],
    });

    expect(result.reply).toBe("Answer");
    expect(result.reasoning_summaries[0]?.text).toHaveLength(640);
  });

  it("degrades a malformed summary list to none without losing the answer", () => {
    const result = conversationRunResponseSchema.parse({
      ...completedRun,
      reasoning_summaries: [{ stage: "unknown_future_stage", text: "" }],
    });

    expect(result.reply).toBe("Answer");
    expect(result.reasoning_summaries).toEqual([]);
  });
});

describe("reasoning summary streaming", () => {
  it("accumulates stages separately and bounds live text", () => {
    const planning = mergeReasoningSummaryDelta(undefined, {
      stage: "retrieval_planning",
      delta: "Focused search. ",
      sequence: 1,
    });
    const both = mergeReasoningSummaryDelta(planning, {
      stage: "answer_synthesis",
      delta: "Grouped evidence.",
      sequence: 1,
    });
    const bounded = mergeReasoningSummaryDelta(both, {
      stage: "retrieval_planning",
      delta: "x".repeat(600),
      sequence: 2,
    });

    expect(both.map((item) => item.stage)).toEqual([
      "retrieval_planning",
      "answer_synthesis",
    ]);
    expect(bounded[0]?.text).toHaveLength(500);
    expect(bounded[1]?.text).toBe("Grouped evidence.");
  });

  /*
   * `source` is a closed contract field naming the producer the backend used.
   * A half-streamed summary has none, and deriving one from `stage` would state
   * provenance the backend never sent — wrong the moment a stage moves to
   * another producer.
   */
  it("never invents the producer while a summary is still streaming", () => {
    const [item] = mergeReasoningSummaryDelta(undefined, {
      stage: "retrieval_planning",
      delta: "Focused search.",
      sequence: 1,
    });

    expect(item).toEqual({
      stage: "retrieval_planning",
      text: "Focused search.",
    });
    expect(item).not.toHaveProperty("source");
  });
});

/*
 * `getAgentTraceStageKeys` falls back to keyword-matching event types and
 * payload *keys* when a run carries no backend `agent_trace` steps, and the
 * persisted `reasoning_summary_generated` payload has a key named `source`.
 * Left in the activity list it matched the retrieval pattern and fabricated a
 * verified retrieval step for a run that never retrieved anything.
 */
describe("reasoning summaries stay out of the verified trace", () => {
  it("classifies the persisted event as a different channel", () => {
    expect(isReasoningSummaryEventType("reasoning_summary_generated")).toBe(
      true,
    );
    expect(isReasoningSummaryEventType("reasoning_summary_delta")).toBe(true);
    expect(isReasoningSummaryEventType("retrieval_completed")).toBe(false);
  });

  it("does not fabricate a retrieval stage from a summary event", () => {
    const summaryEvent = {
      id: "e1",
      run_id: "run-1",
      sequence: 1,
      event_type: "reasoning_summary_generated",
      payload: {
        stage: "answer_synthesis",
        text: "I grouped the evidence.",
        source: "provider_reasoning_summary",
      },
    };

    expect(
      getAgentTraceStageKeys({ events: [summaryEvent], citationCount: 0 }),
    ).toContain("searchingKnowledge");
    expect(
      getAgentTraceStageKeys({
        events: [summaryEvent].filter(
          (event) => !isReasoningSummaryEventType(event.event_type),
        ),
        citationCount: 0,
      }),
    ).toEqual([]);
  });
});

describe("reasoning summary presentation", () => {
  it("renders nothing for an authoritative empty list", () => {
    const html = renderSection([]);

    expect(html).toBe("");
  });

  it("renders model-authored prose as a separately framed quote", () => {
    const html = renderSection([
      { stage: "answer_synthesis", text: "I grouped the evidence." },
    ]);

    expect(html).toContain('data-slot="reasoning-summary"');
    expect(html).toContain("<blockquote");
    expect(html).toContain("I grouped the evidence.");
  });

  it("carries a hidden name instead of a visible heading or disclaimer", () => {
    const html = renderSection([
      { stage: "retrieval_planning", text: "I searched the newest policy." },
    ]);

    expect(html).toContain("sr-only");
    expect(html).toContain(localization.chat.reasoningSummary.label);
    expect(html).not.toContain("How the AI says it approached this");
    expect(html).not.toContain("Written by the AI");
  });

  it("orders stages by sequence rather than by arrival", () => {
    const html = renderSection([
      { stage: "answer_synthesis", text: "Synthesis first in the payload." },
      { stage: "retrieval_planning", text: "Planning second in the payload." },
    ]);

    expect(html.indexOf("Planning second in the payload.")).toBeLessThan(
      html.indexOf("Synthesis first in the payload."),
    );
  });

  it("never carries verified status colours or step dots", () => {
    const html = renderSection([
      { stage: "answer_synthesis", text: "I grouped the evidence." },
    ]);

    expect(html).not.toMatch(/cal-(success|warning|error)/);
    expect(html).not.toContain("rounded-full");
  });

  it("bounds displayed text at the served length", () => {
    const html = renderSection([
      { stage: "answer_synthesis", text: "y".repeat(640) },
    ]);

    expect(html).toContain("y".repeat(500));
    expect(html).not.toContain("y".repeat(501));
  });
});

/*
 * Option B: the model's own account of the approach, raised to the collapsed
 * row while the run is still working. `retrieval_planning` is produced before
 * retrieval executes, so it exists during the wait; `answer_synthesis` comes
 * off the completed response and arrives after there is anything to wait for.
 */
describe("live planning summary on the collapsed row", () => {
  const events = [
    {
      id: "e1",
      run_id: "run-1",
      sequence: 1,
      event_type: "retrieval_completed",
      payload: { authorized_context_count: 2 },
    },
  ];
  const planning = {
    stage: "retrieval_planning" as const,
    text: "관련 조항만 먼저 찾기로 했습니다.",
  };
  const synthesis = {
    stage: "answer_synthesis" as const,
    text: "기한과 위험 순서로 정리했습니다.",
  };

  function renderPanel(
    summaries: Array<{ stage: string; text: string }>,
    isStreaming: boolean,
  ) {
    return renderToStaticMarkup(
      createElement(AgentProcessPanel, {
        localization: localization.chat as never,
        lang: "ko",
        events: events as never,
        citationCount: 0,
        isStreaming,
        reasoningSummaries: summaries as never,
      }),
    );
  }

  it("shows the planning summary while the run is working", () => {
    const html = renderPanel([planning], true);

    expect(html).toContain('data-slot="live-reasoning-summary"');
    expect(html).toContain(planning.text);
  });

  it("keeps the verified step label rather than replacing it", () => {
    const html = renderPanel([planning], true);

    expect(html).toContain(
      localization.chat.answerProcess.stages.searchingKnowledge,
    );
  });

  /*
   * The synthesis text still renders inside the disclosure body — it is a
   * legitimate explanation once the run is over. What it must never do is take
   * the live row, which exists to shorten a wait it arrives too late for.
   */
  it("never raises the synthesis summary, which arrives too late to help", () => {
    const html = renderPanel([synthesis], true);

    expect(html).not.toContain('data-slot="live-reasoning-summary"');
    expect(html).toContain('data-slot="reasoning-summary"');
  });

  it("drops the live row once the run settles", () => {
    const html = renderPanel([planning], false);

    expect(html).not.toContain('data-slot="live-reasoning-summary"');
  });

  it("renders the ordinary row when no planning summary exists", () => {
    const html = renderPanel([], true);

    expect(html).toContain('data-testid="agent-process-panel"');
    expect(html).not.toContain('data-slot="live-reasoning-summary"');
  });
});

/*
 * One message at a time on the collapsed row, with the full set recoverable in
 * the expanded list. The planning summary opens and holds the row through the
 * retrieval wait; step descriptions take it over as they arrive.
 */
describe("the collapsed row shows one process message at a time", () => {
  const planning = {
    stage: "retrieval_planning" as const,
    text: "관련 조항만 먼저 찾기로 했습니다.",
  };
  const events = [
    {
      id: "e1",
      run_id: "run-1",
      sequence: 1,
      event_type: "retrieval_completed",
      payload: {
        agent_trace: [
          {
            id: "candidate_scouts",
            event_type: "candidates_retrieved",
            status: "completed",
            title: { ko: "관련 문서 탐색", en: "Finding documents" },
            description: { ko: "문서를 확인했습니다.", en: "Checked." },
            evidence: {},
          },
        ],
      },
    },
    {
      id: "e2",
      run_id: "run-1",
      sequence: 2,
      event_type: "evidence_completed",
      payload: {
        agent_trace: [
          {
            id: "evidence_judge",
            event_type: "evidence_ranked",
            status: "completed",
            title: { ko: "근거 판정", en: "Evidence Judge" },
            description: { ko: "관련도 정렬을 적용했습니다.", en: "Ordered." },
            evidence: {},
          },
        ],
      },
    },
  ];

  function render(panelEvents: unknown[], isStreaming = true) {
    return renderToStaticMarkup(
      createElement(AgentProcessPanel, {
        localization: localization.chat as never,
        lang: "ko",
        events: panelEvents as never,
        citationCount: 0,
        isStreaming,
        reasoningSummaries: [planning] as never,
      }),
    );
  }

  /*
   * The row's text is split into per-word and per-character spans for the
   * shimmer, so read it by stripping tags rather than matching a bare text
   * node.
   */
  function liveRow(html: string) {
    const match = html.match(
      /data-slot="live-reasoning-summary"[^>]*>([\s\S]*?)<\/p>/,
    );
    return (match?.[1] ?? "").replace(/<[^>]*>/g, "");
  }

  it("opens with the planning summary before any step has spoken", () => {
    const html = render([
      { ...events[0], payload: { authorized_context_count: 2 } },
    ]);

    expect(liveRow(html)).toBe(planning.text);
  });

  it("hands the row to the newest step description", () => {
    expect(liveRow(render([events[0]]))).toBe("문서를 확인했습니다.");
    expect(liveRow(render(events))).toBe("관련도 정렬을 적용했습니다.");
  });

  it("shows exactly one message at a time on the row", () => {
    const html = render(events);
    const rows = html.match(/data-slot="live-reasoning-summary"/g) ?? [];

    expect(rows).toHaveLength(1);
    // Superseded on the row, still present in the disclosure below it.
    expect(liveRow(html)).not.toBe(planning.text);
    expect(html).toContain(planning.text);
  });

  /*
   * The row skipping a message is only acceptable because the expanded list
   * keeps every one of them. Before this, no description rendered at all once a
   * run completed — nothing in `phaseForTraceStep` maps to `answerReady`, the
   * last stage of every successful run, so the terminal branch of the old gate
   * could never fire.
   */
  it("keeps every skipped message recoverable in the expanded list", () => {
    const html = render(
      [
        ...events,
        {
          id: "e3",
          run_id: "run-1",
          sequence: 3,
          event_type: "run_completed",
          payload: {},
        },
      ],
      false,
    );

    expect(html).toContain("문서를 확인했습니다.");
    expect(html).toContain("관련도 정렬을 적용했습니다.");
    expect(html).not.toContain('data-slot="live-reasoning-summary"');
  });
});
