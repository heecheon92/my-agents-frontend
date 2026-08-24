import { describe, expect, it } from "vitest";
import {
  ACTIVE_RUN_STALE_NOTICE_AFTER_MS,
  appendLiveActivityEvent,
  CHAT_SCROLL_REGION_CLASS_NAME,
  CHAT_WORKSPACE_PANEL_CLASS_NAME,
  deriveConversationTitle,
  getAgentTraceStageKeys,
  getConversationCardClassName,
  getLatestAssistantMessageId,
  getNextConversationIdAfterDelete,
  isActiveAgentRunStatus,
  isConversationRunAlreadyActiveError,
  isObservedActiveRunStale,
  REPLAY_ICON_PENDING_CLASS_NAME,
  sanitizeActivityEventPayload,
  shouldRecordLiveActivityEvent,
} from "@/components/ChatWorkspace";
import type { LiveActivityEvent } from "@/components/chat/types";
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
    // Intent, not literal: the pending replay icon must spin in reverse so it
    // reads as "undo/regenerate" rather than "loading". The optional
    // `motion-safe:` prefix lets the reduced-motion pass tighten this without
    // rewriting the test.
    expect(REPLAY_ICON_PENDING_CLASS_NAME).toMatch(
      /^(motion-safe:)?animate-\[spin_[^\]]*_reverse\]$/,
    );
  });

  it("keeps every footer action label present and translated in both locales", () => {
    // Asserted as a contract over the key set rather than as exact sentences.
    // Exact-sentence assertions made every copy edit a two-file change and gave
    // no real protection: they could not tell a good rewrite from a bad one.
    // What actually matters is that each label exists, is non-empty, and is
    // genuinely localized rather than an untranslated English string.
    const footerActionKeys = [
      "replayAction",
      "replayLoading",
      "messageFooterLabel",
      "viewCitationDetails",
      "viewResponseEvidence",
      "deleteConversationAction",
    ] as const;

    for (const key of footerActionKeys) {
      expect(en.chat[key].trim().length).toBeGreaterThan(0);
      expect(ko.chat[key].trim().length).toBeGreaterThan(0);
      // A Korean label that is byte-identical to English is an untranslated string.
      expect(ko.chat[key]).not.toBe(en.chat[key]);
      expect(ko.chat[key]).toMatch(/[가-힣]/);
    }

    // Interpolation contract: the count placeholder must survive rewording.
    expect(en.chat.citationSummary).toContain("{count}");
    expect(ko.chat.citationSummary).toContain("{count}");
    expect(en.chat.deleteConversationConfirm).toContain("{title}");
    expect(ko.chat.deleteConversationConfirm).toContain("{title}");

    // Run status vocabulary must cover every status the UI can render.
    const runStatusKeys = [
      "completed",
      "failed",
      "cancelled",
      "cancelling",
      "running",
      "pending",
    ] as const;
    for (const key of runStatusKeys) {
      expect(en.chat.runStatuses[key].trim().length).toBeGreaterThan(0);
      expect(ko.chat.runStatuses[key].trim().length).toBeGreaterThan(0);
    }
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
    expect(en.chat.runEvidenceLabel.trim().length).toBeGreaterThan(0);
    expect(ko.chat.activityPayloadHidden).toMatch(/[가-힣]/);
  });

  it("keeps answer deltas out of visible live activity history", () => {
    expect(shouldRecordLiveActivityEvent("answer_delta")).toBe(false);
    expect(shouldRecordLiveActivityEvent("run_started")).toBe(true);
    expect(shouldRecordLiveActivityEvent("retrieval_completed")).toBe(true);
    expect(shouldRecordLiveActivityEvent("run_completed")).toBe(true);
  });

  it("keeps same-tick queued live activity IDs unique", () => {
    // Drives the production appender through React's queued-updater shape.
    // The version of this test that re-implemented the caller's counter
    // passed while the real one drifted, so keep the helper in the loop.
    const queuedUpdates = ["run_started", "retrieval_completed"].map(
      (eventType) => (current: LiveActivityEvent[]) =>
        appendLiveActivityEvent(current, { eventType, payload: {} }),
    );

    const events = queuedUpdates.reduce<LiveActivityEvent[]>(
      (current, update) => update(current),
      [],
    );

    expect(events.map((event) => event.id)).toEqual(["live-1", "live-2"]);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
  });

  it("numbers a resumed run's events after the interrupted stream's", () => {
    // The HITL path. A run that suspends to ask a document-source question
    // resumes into a second stream that appends to the list the first one
    // filled. A counter scoped to each stream restarts at 1 and re-issues
    // `live-1`, which React reports as a duplicate key and may resolve by
    // dropping or duplicating an activity row.
    const beforeInterrupt = [
      "run_started",
      "retrieval_completed",
      "run_interrupted",
    ].reduce<LiveActivityEvent[]>(
      (current, eventType) =>
        appendLiveActivityEvent(current, { eventType, payload: {} }),
      [],
    );

    const afterResume = ["run_resumed", "run_completed"].reduce(
      (current, eventType) =>
        appendLiveActivityEvent(current, { eventType, payload: {} }),
      beforeInterrupt,
    );

    expect(afterResume.map((event) => event.id)).toEqual([
      "live-1",
      "live-2",
      "live-3",
      "live-4",
      "live-5",
    ]);
    expect(new Set(afterResume.map((event) => event.id)).size).toBe(
      afterResume.length,
    );
    // The displayed ordinal continues too; a restart would number the
    // resumed half "1." under rows already numbered 1-3.
    expect(afterResume.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5]);
  });

  it("summarizes agentic run events into localized compact trace stages", () => {
    // Every stage the inference below can produce must have copy in both locales.
    const stageKeys = [
      "planning",
      "searchingKnowledge",
      "draftingAnswer",
      "checkingCitations",
      "answerReady",
      "needsEvidence",
    ] as const;
    for (const key of stageKeys) {
      expect(en.chat.agentTrace.stages[key].trim().length).toBeGreaterThan(0);
      expect(ko.chat.agentTrace.stages[key]).toMatch(/[가-힣]/);
    }

    expect(
      getAgentTraceStageKeys({
        citationCount: 2,
        events: [
          {
            id: "live-1",
            sequence: 1,
            event_type: "run_started",
            payload: { knowledge_base_selection: { mode: "all" } },
          },
          {
            id: "live-2",
            sequence: 2,
            event_type: "answer_delta",
            payload: { delta: "hello" },
          },
          {
            id: "live-3",
            sequence: 3,
            event_type: "run_completed",
            payload: { citations: [{ id: "citation-1" }] },
          },
        ],
      }),
    ).toEqual([
      "planning",
      "searchingKnowledge",
      "draftingAnswer",
      "checkingCitations",
      "answerReady",
    ]);

    expect(
      getAgentTraceStageKeys({
        citationCount: 0,
        events: [
          {
            id: "live-1",
            sequence: 1,
            event_type: "run_started",
            payload: {},
          },
          {
            id: "live-2",
            sequence: 2,
            event_type: "run_completed",
            payload: { citations: [] },
          },
        ],
      }).at(-1),
    ).toBe("answerReady");

    expect(
      getAgentTraceStageKeys({
        citationCount: 0,
        events: [
          {
            id: "live-1",
            sequence: 1,
            event_type: "answer_composed",
            payload: { insufficient_evidence: true },
          },
        ],
      }).at(-1),
    ).toBe("needsEvidence");
  });

  it("prefers explicit backend agent trace over broad event heuristics", () => {
    expect(
      getAgentTraceStageKeys({
        citationCount: 0,
        events: [
          {
            id: "live-trace",
            sequence: 1,
            event_type: "run_completed",
            payload: {
              agent_trace: [
                {
                  id: "query_cartographer",
                  event_type: "retrieval_completed",
                  status: "completed",
                  title: { en: "Query Cartographer", ko: "질문 지도화" },
                  description: { en: "Planned", ko: "계획" },
                  evidence: {},
                },
                {
                  id: "candidate_scouts",
                  event_type: "retrieval_completed",
                  status: "skipped",
                  title: { en: "Candidate Scouts", ko: "후보 검색" },
                  description: { en: "Skipped", ko: "건너뜀" },
                  evidence: {},
                },
                {
                  id: "answer_composer",
                  event_type: "answer_composed",
                  status: "completed",
                  title: { en: "Answer Composer", ko: "답변 작성" },
                  description: { en: "Ready", ko: "준비" },
                  evidence: { citation_count: 0 },
                },
              ],
            },
          },
        ],
      }),
    ).toEqual(["planning", "answerReady"]);
  });

  it("keeps terminal failures visible after partial backend traces", () => {
    expect(
      getAgentTraceStageKeys({
        citationCount: 0,
        events: [
          {
            id: "retrieval-trace",
            sequence: 1,
            event_type: "retrieval_completed",
            payload: {
              agent_trace: [
                {
                  id: "query_cartographer",
                  event_type: "retrieval_completed",
                  status: "completed",
                  title: { en: "Query Cartographer", ko: "질문 지도화" },
                  description: { en: "Planned", ko: "계획" },
                  evidence: {},
                },
                {
                  id: "candidate_scouts",
                  event_type: "retrieval_completed",
                  status: "completed",
                  title: { en: "Candidate Scouts", ko: "후보 검색" },
                  description: { en: "Searched", ko: "검색" },
                  evidence: {},
                },
              ],
            },
          },
          {
            id: "run-failed",
            sequence: 2,
            event_type: "run_failed",
            payload: { safe_error_type: "RuntimeError" },
          },
        ],
      }),
    ).toEqual(["planning", "searchingKnowledge", "needsEvidence"]);
  });

  it("keeps selected conversation contrast stable on hover", () => {
    const activeClassName = getConversationCardClassName(true);
    const inactiveClassName = getConversationCardClassName(false);
    const tokensOf = (className: string) =>
      className.split(/\s+/).filter(Boolean);
    const hoverTokensOf = (className: string) =>
      tokensOf(className).filter((token) => token.startsWith("hover:"));

    // Selected and unselected rows must be visually distinguishable.
    expect(activeClassName).not.toBe(inactiveClassName);

    // The real invariant: every hover style on the *selected* row restates a
    // value the row already has, so hovering the current conversation never
    // repaints it. Asserted structurally so it survives any token rename.
    for (const hoverToken of hoverTokensOf(activeClassName)) {
      expect(tokensOf(activeClassName)).toContain(
        hoverToken.slice("hover:".length),
      );
    }

    // The unselected row must still have a hover affordance that actually
    // changes something.
    const inactiveHoverTokens = hoverTokensOf(inactiveClassName);
    expect(inactiveHoverTokens.length).toBeGreaterThan(0);
    expect(
      inactiveHoverTokens.some(
        (hoverToken) =>
          !tokensOf(inactiveClassName).includes(
            hoverToken.slice("hover:".length),
          ),
      ),
    ).toBe(true);
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

  it("names a new conversation after the message that started it", () => {
    expect(deriveConversationTitle("배포 절차를 알려주세요", "fallback")).toBe(
      "배포 절차를 알려주세요",
    );
    // Newlines and runs of whitespace would otherwise land in the sidebar.
    expect(deriveConversationTitle("첫 줄\n\n둘째  줄", "fallback")).toBe(
      "첫 줄 둘째 줄",
    );
    // The backend rejects an empty title, so a whitespace-only draft must not
    // reach it.
    expect(deriveConversationTitle("   \n  ", "fallback")).toBe("fallback");
    expect(deriveConversationTitle("", "fallback")).toBe("fallback");
    // Well inside the schema's 200-character ceiling.
    expect(deriveConversationTitle("가".repeat(500), "fallback")).toHaveLength(
      80,
    );
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
    // Structure, not pixels. Vitest runs in a node environment with no DOM, so
    // it can only string-match; the measured version of this contract lives in
    // `expectChatTranscriptLayoutBounded` (e2e/helpers/chat-layout.ts), which
    // reads real computed style at 390/768/1280.
    //
    // The panel must be a height-bounded flex column that clips its own
    // overflow, so the transcript scrolls inside it rather than growing the page.
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toMatch(/(^|\s)flex(\s|$)/);
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toMatch(/(^|\s)min-h-0(\s|$)/);
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toMatch(
      /(^|\s)overflow-hidden(\s|$)/,
    );
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toMatch(/(^|\s)(\w+:)?h-\S+/);

    // The scroll region is the single element that actually scrolls.
    expect(CHAT_SCROLL_REGION_CLASS_NAME).toMatch(/(^|\s)min-h-0(\s|$)/);
    expect(CHAT_SCROLL_REGION_CLASS_NAME).toMatch(/(^|\s)flex-1(\s|$)/);
    expect(CHAT_SCROLL_REGION_CLASS_NAME).toMatch(
      /(^|\s)overflow-(auto|y-auto)(\s|$)/,
    );
    expect(CHAT_SCROLL_REGION_CLASS_NAME).not.toMatch(/calc\(/);
  });

  it("delegates viewport bounding to the shell, not to hardcoded math", () => {
    // A deliberately literal assertion, locking in an architectural decision
    // rather than a pixel. The panel used to be `h-[calc(100dvh-8rem)]`, which
    // assumed 64px of shell padding while the shell actually uses 16px at
    // mobile — so it was wrong at exactly the widths it mattered most.
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).not.toMatch(/calc\(100dvh/);
    expect(CHAT_WORKSPACE_PANEL_CLASS_NAME).toMatch(/(^|\s)h-full(\s|$)/);
  });
});
