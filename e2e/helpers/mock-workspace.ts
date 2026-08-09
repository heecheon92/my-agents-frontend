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

const mockCitation = {
  id: "citation-visual",
  document_id: "doc-contract",
  knowledge_base_id: "kb-personal",
  chunk_id: "chunk-4",
  snippet:
    "갱신 통지는 만료 60일 전까지 서면으로 이루어져야 하며, 통지가 없으면 1년 자동 연장된다.",
  source_page: 4,
  source_filename: "partner-contract-2026.pdf",
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
};

export async function mockWorkspace(
  page: Page,
  overrides: RouteOverrides = {},
) {
  const { anonymous = false, guest = false, empty = false } = overrides;
  const knowledgeBases = empty ? [] : mockKnowledgeBases;
  const documents = empty ? [] : mockDocuments;
  const conversations = empty ? [] : [mockConversation];
  const groups = empty ? [] : [mockGroup];

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
      return json(empty ? [] : [mockRun]);
    }
    if (
      path === `/conversations/${mockConversation.id}/runs/${mockRun.run_id}`
    ) {
      return json({
        ...mockRun,
        reply: "갱신 통지 기한이 가장 큰 위험입니다.",
        citations: [mockCitation],
      });
    }
    if (
      path ===
      `/conversations/${mockConversation.id}/runs/${mockRun.run_id}/events`
    ) {
      return json([
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
          payload: { documents: 2 },
        },
        {
          id: "event-3",
          run_id: mockRun.run_id,
          sequence: 3,
          event_type: "run_completed",
          payload: { citations: [{ id: mockCitation.id }] },
        },
      ]);
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
