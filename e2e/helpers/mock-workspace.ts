import type { Page } from "@playwright/test";
import ko from "@/localization/ko.json";

/**
 * A populated, fully mocked workspace covering every authenticated route.
 *
 * Fixtures match the zod schemas in `model/my-agents/*` — the service layer
 * parses every response, so a shape mismatch renders an error state instead of
 * the screen under test. Keep these in sync with those schemas.
 */

const NOW = "2026-06-01T00:00:00.000Z";
const LATER = "2026-07-01T00:00:00.000Z";

export const mockUser = {
  id: "u-visual",
  email: "designer@example.com",
  nickname: "디자이너",
  email_verified_at: NOW,
  is_guest: false,
};

export const mockGroup = {
  id: "g-visual",
  name: "제품팀",
  role: "owner" as const,
};

export const mockKnowledgeBases = [
  {
    id: "kb-personal",
    name: "개인 자료",
    scope: "personal" as const,
    owner_user_id: mockUser.id,
    group_id: null,
    purpose: "standard" as const,
    published_group_ids: [],
    created_at: NOW,
  },
  {
    id: "kb-group",
    name: "제품팀 공유 자료",
    scope: "group" as const,
    owner_user_id: mockUser.id,
    group_id: mockGroup.id,
    purpose: "standard" as const,
    published_group_ids: [mockGroup.id],
    created_at: NOW,
  },
];

export const mockDocuments = [
  {
    id: "doc-contract",
    title: "2026 파트너 계약서",
    owner_user_id: mockUser.id,
    group_id: null,
    knowledge_base_id: "kb-personal",
    source_type: "pdf_upload",
    source_filename: "partner-contract-2026.pdf",
    source_content_type: "application/pdf",
    source_byte_size: 482_133,
    source_page_count: 12,
    parser_name: "pdf",
  },
  {
    id: "doc-note",
    title: "온보딩 메모",
    owner_user_id: mockUser.id,
    group_id: null,
    knowledge_base_id: "kb-personal",
    source_type: "text",
    source_filename: null,
    source_content_type: null,
    source_byte_size: null,
    source_page_count: null,
    parser_name: null,
  },
];

const mockConversation = {
  id: "c-visual",
  title: "계약 갱신 검토",
  owner_user_id: mockUser.id,
};

const mockRun = {
  run_id: "run-visual",
  conversation_id: mockConversation.id,
  status: "completed",
  route_label: "research_helper",
  created_at: NOW,
};

/**
 * A run suspended on an unanswered document choice, as the run list reports it
 * after a reload. This is the cold-load recovery fixture: no stream is
 * involved, so the card must be rebuilt from server state alone.
 */
export const mockWaitingRun = {
  run_id: "run-waiting",
  conversation_id: mockConversation.id,
  status: "waiting_for_input",
  route_label: null,
  created_at: LATER,
};

export const mockPendingInteraction = {
  schema_version: 1,
  interaction_id: "run-waiting:document_selection",
  type: "document_selection",
  reason_code: "ambiguous_document_reference",
  message_key: "clarification.document_scope.select_source",
  // Far future so the card is answerable; the expiry spec overrides it.
  expires_at: "2099-01-01T00:00:00.000Z",
  option_count: 2,
  options: [
    {
      document_id: "doc-contract",
      title: "2026 파트너 계약서",
      source_filename: "partner-contract-2026.pdf",
      knowledge_base_id: "kb-personal",
      knowledge_base_name: "개인 자료",
    },
    {
      document_id: "doc-note",
      title: "온보딩 메모",
      source_filename: null,
      knowledge_base_id: null,
      knowledge_base_name: null,
    },
  ],
  next_cursor: null,
};

/**
 * The same question with a list long enough to outgrow the panel.
 *
 * The backend pages at 20, and `option_count` is unbounded — a vague reference
 * across a large knowledge base legitimately produces a full page. Every other
 * fixture here has two options, which is why nothing caught the overflow.
 */
export const mockManyOptionInteraction = {
  ...mockPendingInteraction,
  option_count: 40,
  options: Array.from({ length: 20 }, (_, index) => ({
    document_id: `doc-many-${index}`,
    title: `자료 ${index + 1}`,
    source_filename: `source-${index + 1}.pdf`,
    knowledge_base_id: "kb-personal",
    knowledge_base_name: "개인 자료",
  })),
  next_cursor: "cursor-page-2",
};

const mockCitation = {
  id: "citation-visual",
  document_id: "doc-contract",
  document_title: "2026 파트너 계약서",
  knowledge_base_id: "kb-personal",
  knowledge_base_name: "개인 자료",
  chunk_id: "chunk-4",
  snippet:
    "갱신 통지는 만료 60일 전까지 서면으로 이루어져야 하며, 통지가 없으면 1년 자동 연장된다.",
  source_page: 4,
  source_filename: "partner-contract-2026.pdf",
};

/**
 * A second chunk of the *same* document, on a different page.
 *
 * Without this the grouping is untestable: every fixture document contributed
 * exactly one chunk, so one-row-per-chunk and one-row-per-document produced
 * identical output.
 */
const mockSecondChunkOfCitedDocument = {
  ...mockCitation,
  id: "citation-visual-2",
  chunk_id: "chunk-9",
  snippet: "위약금은 잔여 계약 기간의 30퍼센트로 한다.",
  source_page: 9,
};

/**
 * A source given to composition that the answer did not verifiably use.
 *
 * Deliberately absent from `citations`: the whole point of the attributed mode
 * is that consulted is a superset, so a fixture where the two lists are equal
 * would prove nothing.
 */
const mockConsultedOnlySource = {
  id: "citation-consulted-only",
  document_id: "doc-roadmap",
  document_title: "제품 로드맵 2026",
  knowledge_base_id: "kb-personal",
  knowledge_base_name: "개인 자료",
  chunk_id: "chunk-11",
  snippet: "2분기 목표는 파트너 채널 확대와 온보딩 자동화입니다.",
  source_page: 11,
  source_filename: "product-roadmap-2026.pdf",
};

const mockMember = {
  member_id: "m-1",
  user_id: mockUser.id,
  nickname: "디자이너",
  role: "owner" as const,
  created_at: NOW,
};

const mockInvitation = {
  id: "inv-1",
  group_id: mockGroup.id,
  invited_email: "teammate@example.com",
  role: "editor" as const,
  status: "pending" as const,
  created_at: NOW,
  expires_at: LATER,
  accepted_at: null,
  cancelled_at: null,
  resent_at: null,
};

const mockPublishRequest = {
  id: "pr-1",
  requester_user_id: mockUser.id,
  target_group_id: mockGroup.id,
  target_knowledge_base_id: "kb-group",
  source_document_id: "doc-contract",
  source_knowledge_base_id: null,
  source_document_title: "2026 파트너 계약서",
  source_document_excerpt: "갱신 통지는 만료 60일 전까지 서면으로…",
  source_document_filename: "partner-contract-2026.pdf",
  source_knowledge_base_name: null,
  target_knowledge_base_name: "제품팀 공유 자료",
  status: "pending" as const,
  reviewer_user_id: null,
  published_document_id: null,
  published_knowledge_base_id: null,
  created_at: NOW,
  reviewed_at: null,
};

type RouteOverrides = {
  /** Render the shell as an unauthenticated visitor. */
  anonymous?: boolean;
  /** Render the guest-limited variant of the workspace. */
  guest?: boolean;
  /** Render empty collections to capture empty states. */
  empty?: boolean;
  /** Serve reasoning capabilities. `false` 404s them, as a backend without the migration does. */
  reasoning?: boolean;
  /**
   * Serve a run suspended on a pending interaction, as after a reload.
   * Omitted entirely by default so every existing spec keeps proving the
   * flag-off composer is unchanged.
   */
  /**
   * How the completed run reports citation attribution.
   * `false` omits `consulted_sources` entirely, as a backend without the
   * attribution migration does — that is the default so every existing spec
   * keeps proving the legacy panel is unchanged.
   */
  attribution?: false | "supported" | "none";
  /** Add refresh-safe comprehensive-document coverage to the completed run. */
  documentCoverage?: false | "complete" | "partial";
  processState?:
    | "completed"
    | "failed"
    | "cancelled"
    | "needs_evidence"
    | "no_events";
  interaction?:
    | false
    | "document_selection"
    | "many_options"
    | "unsupported_type"
    | "unsupported_version"
    | "expired";
};

export async function mockWorkspace(
  page: Page,
  overrides: RouteOverrides = {},
) {
  const {
    anonymous = false,
    guest = false,
    empty = false,
    reasoning = true,
    attribution = false,
    documentCoverage = false,
    processState = "completed",
    interaction = false,
  } = overrides;
  const consultedSources = !attribution
    ? undefined
    : [mockCitation, mockSecondChunkOfCitedDocument, mockConsultedOnlySource];
  // "none" is the case the backend expects to be common: sources were read, but
  // the conservative selector matched none of them to the answer.
  const attributedCitations = attribution === "none" ? [] : [mockCitation];
  const coverage = !documentCoverage
    ? null
    : {
        mode: documentCoverage,
        document_id: mockCitation.document_id,
        title: "2026 파트너 계약서",
        source_filename: mockCitation.source_filename,
        start_offset: 0,
        end_offset: documentCoverage === "complete" ? 8_400 : 12_000,
        total_chars: documentCoverage === "complete" ? 8_400 : 32_000,
      };
  const pendingInteraction = !interaction
    ? null
    : interaction === "many_options"
      ? mockManyOptionInteraction
      : interaction === "unsupported_type"
        ? { ...mockPendingInteraction, type: "approval" }
        : interaction === "unsupported_version"
          ? { ...mockPendingInteraction, schema_version: 2 }
          : interaction === "expired"
            ? {
                ...mockPendingInteraction,
                expires_at: "2020-01-01T00:00:00.000Z",
              }
            : mockPendingInteraction;
  const knowledgeBases = empty ? [] : mockKnowledgeBases;
  const documents = empty ? [] : mockDocuments;
  const conversations = empty ? [] : [mockConversation];
  const groups = empty ? [] : [mockGroup];
  const processRun = {
    ...mockRun,
    status:
      processState === "failed"
        ? "failed"
        : processState === "cancelled"
          ? "cancelled"
          : "completed",
  };
  const traceStep = (
    id: string,
    eventType: string,
    koTitle: string,
    enTitle: string,
    koDescription: string,
    enDescription: string,
    status: "completed" | "waiting" = "completed",
  ) => ({
    id,
    event_type: eventType,
    status,
    title: { ko: koTitle, en: enTitle },
    description: { ko: koDescription, en: enDescription },
    evidence: {},
  });
  const retrievalTrace = [
    traceStep(
      "query_cartographer",
      "query_planned",
      "질문 의도 정리",
      "Mapped the question",
      "계약 갱신 조건을 찾도록 질문 범위를 정했습니다.",
      "Scoped the question to contract renewal terms.",
    ),
    traceStep(
      "source_warden",
      "sources_authorized",
      "문서 범위 확인",
      "Checked document scope",
      "선택한 지식 베이스에서 사용할 문서를 확인했습니다.",
      "Checked usable documents in the selected knowledge bases.",
    ),
    traceStep(
      "candidate_scouts",
      "candidates_retrieved",
      "관련 문서 탐색",
      "Found relevant documents",
      "질문과 관련된 문서 후보를 찾았습니다.",
      "Found document candidates relevant to the question.",
    ),
    traceStep(
      "context_curator",
      "context_prepared",
      "답변 자료 구성",
      "Prepared answer context",
      "답변에 사용할 문서 내용을 정리했습니다.",
      "Prepared document context for the answer.",
    ),
  ];
  const processEvents =
    processState === "no_events"
      ? []
      : processState === "failed"
        ? [
            {
              id: "event-1",
              run_id: mockRun.run_id,
              sequence: 1,
              event_type: "run_started",
              payload: { knowledge_base_selection: { mode: "all" } },
            },
            {
              id: "event-2",
              run_id: mockRun.run_id,
              sequence: 2,
              event_type: "retrieval_completed",
              payload: { documents: 2, agent_trace: retrievalTrace },
            },
            {
              id: "event-3",
              run_id: mockRun.run_id,
              sequence: 3,
              event_type: "run_failed",
              payload: {},
            },
          ]
        : processState === "cancelled"
          ? [
              {
                id: "event-1",
                run_id: mockRun.run_id,
                sequence: 1,
                event_type: "run_started",
                payload: { knowledge_base_selection: { mode: "all" } },
              },
              {
                id: "event-2",
                run_id: mockRun.run_id,
                sequence: 2,
                event_type: "graph_invoked",
                payload: {
                  agent_trace: [
                    traceStep(
                      "assistant_graph",
                      "answer_drafting",
                      "답변 구성 시작",
                      "Started drafting",
                      "확인한 문서 내용으로 답변을 구성했습니다.",
                      "Started composing from the checked document context.",
                      "waiting",
                    ),
                  ],
                },
              },
              {
                id: "event-3",
                run_id: mockRun.run_id,
                sequence: 3,
                event_type: "run_cancelled",
                payload: {},
              },
            ]
          : processState === "needs_evidence"
            ? [
                {
                  id: "event-1",
                  run_id: mockRun.run_id,
                  sequence: 1,
                  event_type: "run_started",
                  payload: { knowledge_base_selection: { mode: "all" } },
                },
                {
                  id: "event-2",
                  run_id: mockRun.run_id,
                  sequence: 2,
                  event_type: "retrieval_completed",
                  payload: {
                    insufficient_evidence: true,
                    agent_trace: retrievalTrace,
                  },
                },
                {
                  id: "event-3",
                  run_id: mockRun.run_id,
                  sequence: 3,
                  event_type: "run_completed",
                  payload: {},
                },
              ]
            : [
                {
                  id: "event-1",
                  run_id: mockRun.run_id,
                  sequence: 1,
                  event_type: "run_started",
                  payload: { knowledge_base_selection: { mode: "all" } },
                },
                {
                  id: "event-2",
                  run_id: mockRun.run_id,
                  sequence: 2,
                  event_type: "retrieval_completed",
                  payload: { documents: 2, agent_trace: retrievalTrace },
                },
                {
                  id: "event-3",
                  run_id: mockRun.run_id,
                  sequence: 3,
                  event_type: "run_completed",
                  payload: {
                    citations: [{ id: mockCitation.id }],
                    agent_trace: [
                      ...retrievalTrace,
                      traceStep(
                        "evidence_judge",
                        "citations_checked",
                        "근거 연결 확인",
                        "Checked evidence links",
                        "답변과 문서 근거의 연결을 확인했습니다.",
                        "Checked links between the answer and document evidence.",
                      ),
                      traceStep(
                        "answer_composer",
                        "answer_composed",
                        "답변 작성 완료",
                        "Completed the answer",
                        "확인한 근거를 바탕으로 답변을 마쳤습니다.",
                        "Completed the answer from the checked evidence.",
                      ),
                    ],
                  },
                },
              ];

  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const method = request.method();
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (method !== "GET") return json({ ok: true });

    if (path === "/auth/me") {
      if (anonymous) return json({ detail: "Not authenticated" }, 401);
      return json({ ...mockUser, is_guest: guest });
    }
    if (path === "/health") return json({ status: "ok" });
    if (path === "/capabilities/reasoning") {
      // A backend without the reasoning migration 404s here, and the composer
      // must fall back to hiding its controls rather than erroring.
      if (!reasoning) return json({ detail: "Not found" }, 404);
      return json({
        customizable: !guest,
        default_mode: "standard",
        default_effort: "medium",
        supported_modes: ["standard", "pro"],
        supported_efforts: [
          "none",
          "minimal",
          "low",
          "medium",
          "high",
          "xhigh",
          "max",
        ],
        chat: { pro_supported: true },
        document_workspace: { pro_supported: true },
      });
    }
    if (path === "/memories/settings") {
      return json({ enabled: false, updated_at: NOW });
    }

    if (path === "/groups") return json(groups);
    if (path === `/groups/${mockGroup.id}`) return json(mockGroup);
    if (path === `/groups/${mockGroup.id}/members`) {
      return json(empty ? [] : [mockMember]);
    }
    if (path === `/groups/${mockGroup.id}/invitations`) {
      return json(empty ? [] : [mockInvitation]);
    }
    if (path === `/groups/${mockGroup.id}/publish-requests`) {
      return json(empty ? [] : [mockPublishRequest]);
    }

    if (path === "/knowledge-bases") return json(knowledgeBases);
    const knowledgeBaseDetail = path.match(/^\/knowledge-bases\/([^/]+)$/);
    if (knowledgeBaseDetail) {
      const match = knowledgeBases.find(
        (item) => item.id === knowledgeBaseDetail[1],
      );
      return match ? json(match) : json({ detail: "Not found" }, 404);
    }
    const knowledgeBaseDocuments = path.match(
      /^\/knowledge-bases\/([^/]+)\/documents$/,
    );
    if (knowledgeBaseDocuments) {
      return json(
        documents.filter(
          (item) => item.knowledge_base_id === knowledgeBaseDocuments[1],
        ),
      );
    }
    if (
      /^\/knowledge-bases\/[^/]+\/documents\/[^/]+\/extraction-runs$/.test(path)
    ) {
      return json([
        {
          id: "run-extract-1",
          document_id: "doc-contract",
          status: "completed",
          stage: "completed",
          progress_percent: 100,
          chunk_count: 42,
          entity_count: 17,
          relationship_count: 9,
          error: null,
          started_at: NOW,
          completed_at: NOW,
        },
      ]);
    }

    if (path === "/documents") return json(documents);

    if (path === "/conversations") return json(conversations);
    if (path === `/conversations/${mockConversation.id}`) {
      return json(mockConversation);
    }
    if (path === `/conversations/${mockConversation.id}/messages`) {
      return json(
        empty
          ? []
          : [
              {
                id: "m-user",
                conversation_id: mockConversation.id,
                role: "user",
                content: "이 계약서의 갱신 리스크를 알려 주세요.",
              },
              {
                id: "m-assistant",
                conversation_id: mockConversation.id,
                role: "assistant",
                content:
                  "갱신 통지 기한이 가장 큰 위험입니다.\n\n- 만료 **60일 전**까지 서면 통지가 필요합니다.\n- 통지가 없으면 계약이 1년 자동 연장됩니다.",
              },
            ],
      );
    }
    if (path === `/conversations/${mockConversation.id}/runs`) {
      if (pendingInteraction) return json([mockWaitingRun, mockRun]);
      return json(empty ? [] : [processRun]);
    }
    if (
      pendingInteraction &&
      path ===
        `/conversations/${mockConversation.id}/runs/${mockWaitingRun.run_id}`
    ) {
      // The refresh contract: a waiting run reports its pending interaction
      // here, which is what lets a reload rebuild the card.
      return json({
        status: "waiting_for_input",
        run_id: mockWaitingRun.run_id,
        conversation_id: mockConversation.id,
        interaction: pendingInteraction,
      });
    }
    if (
      path === `/conversations/${mockConversation.id}/runs/${mockRun.run_id}`
    ) {
      return json({
        ...mockRun,
        reply: "갱신 통지 기한이 가장 큰 위험입니다.",
        // `route` and `handled_by` are required by
        // `conversationRunResponseSchema`. Without them the whole response
        // failed to parse and the evidence panel silently rendered no sources
        // at all — which is why no spec using this fixture had ever asserted
        // on a citation.
        route: {
          label: mockRun.route_label,
          explanation: "문서 근거가 필요한 질문으로 판단했습니다.",
        },
        handled_by: "personal_assistant_graph",
        citations: attribution ? attributedCitations : [mockCitation],
        ...(consultedSources ? { consulted_sources: consultedSources } : {}),
        ...(documentCoverage ? { document_coverage: coverage } : {}),
      });
    }
    // The suspended run's stored activity. It exists server-side but has no
    // stream behind it after a reload, so this is the only source the panel
    // has while the question is open.
    if (
      path ===
      `/conversations/${mockConversation.id}/runs/${mockWaitingRun.run_id}/events`
    ) {
      return json([
        {
          id: "waiting-event-1",
          run_id: mockWaitingRun.run_id,
          sequence: 1,
          event_type: "run_started",
          payload: { knowledge_base_selection: { mode: "all" } },
        },
        {
          id: "waiting-event-2",
          run_id: mockWaitingRun.run_id,
          sequence: 2,
          event_type: "retrieval_completed",
          payload: { matched_documents: 2, agent_trace: retrievalTrace },
        },
        {
          id: "waiting-event-3",
          run_id: mockWaitingRun.run_id,
          sequence: 3,
          event_type: "run_interrupted",
          payload: { reason_code: "ambiguous_document_reference" },
        },
      ]);
    }
    if (
      path ===
      `/conversations/${mockConversation.id}/runs/${mockRun.run_id}/events`
    ) {
      return json(processEvents);
    }

    return json([]);
  });
}

/**
 * Onboarding auto-prompts on first visit and would cover every screenshot.
 *
 * Dismissed through the real UI rather than by seeding storage: authenticated
 * decisions are keyed by a salted hash of the user id (`opaqueIdentityBucket`
 * in `components/onboarding/onboarding-store.ts`), which a test cannot
 * reproduce without duplicating the hash. Clicking the button also keeps this
 * working if the persistence format changes.
 */
/**
 * The Next dev-mode indicator floats over the bottom-left corner of every dev
 * server page and would otherwise appear in every evidence screenshot.
 */
export async function hideDevIndicators(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

export async function dismissOnboarding(page: Page) {
  const notNow = page.getByRole("button", { name: ko.onboarding.notNow });
  if (await notNow.isVisible().catch(() => false)) {
    await notNow.click();
    await notNow.waitFor({ state: "hidden" });
  }
}
