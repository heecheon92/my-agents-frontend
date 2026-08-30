import { describe, expect, it } from "vitest";
import type {
  AgentProcessState,
  AgentProcessTerminal,
  AgentTraceStageKey,
} from "@/components/chat/evidence-panel/trace";
import {
  getAgentProcessDetails,
  getAgentProcessHeadline,
  getAgentProcessState,
} from "@/components/chat/evidence-panel/trace";
import type {
  ChatLocalization,
  LiveActivityEvent,
} from "@/components/chat/types";
import ko from "@/localization/ko.json";

function event(
  sequence: number,
  eventType: string,
  payload: unknown = {},
): LiveActivityEvent {
  return {
    id: `event-${sequence}`,
    sequence,
    event_type: eventType,
    payload,
  };
}

describe("getAgentProcessState", () => {
  it("returns reached stages only and never invents a future total", () => {
    const state = getAgentProcessState({
      events: [
        event(1, "run_started"),
        event(2, "retrieval_completed", {
          agent_trace: [
            {
              id: "query_cartographer",
              event_type: "query_planned",
              status: "completed",
              title: { ko: "계획", en: "Plan" },
              description: { ko: "", en: "" },
              evidence: {},
            },
            {
              id: "candidate_scouts",
              event_type: "candidates_retrieved",
              status: "completed",
              title: { ko: "검색", en: "Search" },
              description: { ko: "", en: "" },
              evidence: {},
            },
            {
              id: "answer_composer",
              event_type: "answer_composed",
              status: "skipped",
              title: { ko: "답변", en: "Answer" },
              description: { ko: "", en: "" },
              evidence: {},
            },
          ],
        }),
      ],
      citationCount: 0,
      isStreaming: true,
    });

    expect(state.stages).toEqual(["planning", "searchingKnowledge"]);
    expect(state.currentStage).toBe("searchingKnowledge");
    expect(state.terminal).toBeNull();
  });

  it.each([
    ["run_failed", "failed"],
    ["run_cancelled", "cancelled"],
    ["run_interrupted", "waitingForConfirmation"],
  ] as const)(
    "maps %s to the truthful resting terminal",
    (eventType, terminal) => {
      const state = getAgentProcessState({
        events: [event(1, "run_started"), event(2, eventType)],
        citationCount: 0,
        isStreaming: false,
      });

      expect(state.terminal).toBe(terminal);
      expect(state.currentStage).toBeNull();
    },
  );

  it("does not keep a resumed run in the suspended resting state", () => {
    const state = getAgentProcessState({
      events: [
        event(1, "run_interrupted"),
        event(2, "run_resumed"),
        event(3, "graph_invoked"),
      ],
      citationCount: 0,
      isStreaming: true,
    });

    expect(state.terminal).toBeNull();
    expect(state.currentStage).not.toBeNull();
  });

  it("treats an in-flight resume as active before run_resumed arrives", () => {
    const state = getAgentProcessState({
      events: [event(1, "run_started"), event(2, "run_interrupted")],
      citationCount: 0,
      isStreaming: true,
    });

    expect(state.terminal).toBeNull();
    expect(state.currentStage).toBe("planning");
  });

  it("reuses the existing needs-evidence stage for insufficient evidence", () => {
    const state = getAgentProcessState({
      events: [
        event(1, "retrieval_completed", { insufficient_evidence: true }),
        event(2, "run_completed"),
      ],
      citationCount: 0,
      isStreaming: false,
    });

    expect(state.stages.at(-1)).toBe("needsEvidence");
    expect(state.terminal).toBe("needsEvidence");
    expect(state.currentStage).toBeNull();
  });

  it("returns no process surface when no event has been observed", () => {
    expect(
      getAgentProcessState({
        events: [],
        citationCount: 0,
        isStreaming: true,
      }),
    ).toEqual({ stages: [], currentStage: null, terminal: null });
  });
});

describe("getAgentProcessDetails", () => {
  it("gives a lone unknown agent the same fallback phase in spine and detail", () => {
    const events = [
      event(1, "graph_invoked", {
        agent_trace: [
          {
            id: "future_answer_worker",
            event_type: "answer_rewritten",
            status: "completed",
            title: { ko: "새 답변 작업", en: "New answer work" },
            description: {
              ko: "새 답변 단계를 마쳤습니다.",
              en: "Completed the new answer step.",
            },
            evidence: {},
          },
        ],
      }),
    ];

    const state = getAgentProcessState({
      events,
      citationCount: 0,
      isStreaming: true,
    });
    const details = getAgentProcessDetails({ events, lang: "ko" });

    expect(state.stages).toEqual(["draftingAnswer"]);
    expect(details).toHaveLength(1);
    expect(details[0]?.phase).toBe(state.stages[0]);
  });

  it("keeps backend-authored localized details, including unknown agent ids", () => {
    const details = getAgentProcessDetails({
      events: [
        event(1, "retrieval_completed", {
          agent_trace: [
            {
              id: "query_cartographer",
              event_type: "query_planned",
              status: "completed",
              title: { ko: "질문 경로 정리", en: "Mapped the question" },
              description: {
                ko: "검색할 범위를 정했습니다.",
                en: "Selected the search scope.",
              },
              evidence: {},
            },
            {
              id: "future_agent",
              event_type: "future_step_completed",
              status: "completed",
              title: { ko: "새 작업 확인", en: "Checked new work" },
              description: {
                ko: "새 단계가 완료되었습니다.",
                en: "The new step completed.",
              },
              evidence: {},
            },
          ],
        }),
      ],
      lang: "ko",
    });

    expect(details).toEqual([
      {
        key: "query_cartographer:query_planned",
        phase: "planning",
        title: "질문 경로 정리",
        description: "검색할 범위를 정했습니다.",
        status: "completed",
      },
      {
        key: "future_agent:future_step_completed",
        phase: "searchingKnowledge",
        title: "새 작업 확인",
        description: "새 단계가 완료되었습니다.",
        status: "completed",
      },
    ]);
  });

  it("deduplicates cumulative trace payloads and keeps the newest status", () => {
    const trace = {
      id: "assistant_graph",
      event_type: "answer_drafted",
      title: { ko: "답변 작성", en: "Drafted answer" },
      description: { ko: "답변을 작성했습니다.", en: "Drafted the answer." },
      evidence: {},
    };
    const details = getAgentProcessDetails({
      events: [
        event(1, "graph_invoked", {
          agent_trace: [{ ...trace, status: "waiting" }],
        }),
        event(2, "answer_composed", {
          agent_trace: [{ ...trace, status: "completed" }],
        }),
      ],
      lang: "en",
    });

    expect(details).toHaveLength(1);
    expect(details[0]).toMatchObject({
      title: "Drafted answer",
      status: "completed",
    });
  });
});

describe("getAgentProcessHeadline", () => {
  const localization = ko.chat as unknown as ChatLocalization;

  function headlineFor(state: Partial<AgentProcessState>, isStarting = false) {
    return getAgentProcessHeadline({
      state: {
        stages: [],
        currentStage: null,
        terminal: null,
        ...state,
      },
      localization,
      isStarting,
    });
  }

  it("names the step being worked on and marks it live", () => {
    expect(
      headlineFor({
        stages: ["planning", "searchingKnowledge"],
        currentStage: "searchingKnowledge",
      }),
    ).toEqual({
      label: ko.chat.agentTrace.stages.searchingKnowledge,
      isLive: true,
      current: true,
      terminal: null,
    });
  });

  it("shows the starting label before any stage is derivable", () => {
    expect(headlineFor({}, true)).toEqual({
      label: ko.chat.agentTrace.starting,
      isLive: true,
      current: true,
      terminal: null,
    });
  });

  it("carries the terminal marker rather than a live step", () => {
    const terminals: Array<[AgentProcessTerminal, string]> = [
      ["failed", ko.chat.agentTrace.terminals.failed],
      ["cancelled", ko.chat.agentTrace.terminals.cancelled],
      ["waitingForConfirmation", ko.chat.agentTrace.terminals.waiting],
    ];
    for (const [terminal, label] of terminals) {
      expect(headlineFor({ stages: ["planning"], terminal })).toEqual({
        label,
        isLive: false,
        current: false,
        terminal,
      });
    }
  });

  it("names the reached stage for a terminal with no terminal label", () => {
    // `needsEvidence` is reported as a stage, not as an outcome sentence, so
    // the headline must not fall through to the generic last-stage branch and
    // silently drop the warning treatment.
    expect(
      headlineFor({
        stages: ["planning", "needsEvidence"],
        terminal: "needsEvidence",
      }),
    ).toEqual({
      label: ko.chat.agentTrace.stages.needsEvidence,
      isLive: false,
      current: false,
      terminal: "needsEvidence",
    });
  });

  it("summarises a completed run by its step count", () => {
    const stages: AgentTraceStageKey[] = [
      "planning",
      "searchingKnowledge",
      "answerReady",
    ];
    expect(headlineFor({ stages, terminal: "completed" })).toEqual({
      label: ko.chat.agentTrace.completedSummary.replace("{count}", "3"),
      isLive: false,
      current: false,
      terminal: null,
    });
  });

  it("names the furthest stage when no lifecycle event arrived", () => {
    // A cold load of a run whose terminal event was never stored. Claiming
    // completion here would overstate what the events support.
    expect(headlineFor({ stages: ["planning", "draftingAnswer"] })).toEqual({
      label: ko.chat.agentTrace.stages.draftingAnswer,
      isLive: false,
      current: false,
      terminal: null,
    });
  });

  it("has nothing to show without stages or a terminal", () => {
    expect(headlineFor({})).toBeNull();
  });
});
