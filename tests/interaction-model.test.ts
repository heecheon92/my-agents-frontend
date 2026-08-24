import { describe, expect, it } from "vitest";
import {
  conversationRunInterruptedResponseSchema,
  conversationRunResultSchema,
  conversationRunResumeRequestSchema,
  documentSelectionOptionsPageSchema,
  INTERACTION_SCHEMA_VERSION,
  isDocumentSelection,
  isRunInterrupted,
  pendingInteractionSchema,
} from "@/model/my-agents";

/**
 * The exact body the backend streams on `run_interrupted`.
 *
 * The SSE event emits `ConversationRunInterruptedResponse.model_dump()` — the
 * same full payload as the HTTP 202, not the thinner persisted activity row —
 * so every field the contract marks required is present here on purpose. This
 * fixture is the guard against loosening the known schema to accommodate a
 * source that does not actually exist.
 */
const interruptedBody = {
  status: "waiting_for_input",
  run_id: "run-1",
  conversation_id: "c-1",
  interaction: {
    schema_version: 1,
    interaction_id: "run-1:document_selection",
    type: "document_selection",
    reason_code: "ambiguous_document_reference",
    message_key: "clarification.document_scope.select_source",
    expires_at: "2026-08-18T00:00:00Z",
    option_count: 2,
    options: [
      {
        document_id: "doc-1",
        title: "2026 파트너 계약서",
        source_filename: "partner-contract-2026.pdf",
        knowledge_base_id: "kb-personal",
        knowledge_base_name: "개인 자료",
      },
      {
        document_id: "doc-2",
        title: "온보딩 메모",
        source_filename: null,
        knowledge_base_id: null,
        knowledge_base_name: null,
      },
    ],
    next_cursor: null,
  },
};

describe("interrupted run parsing", () => {
  it("parses the full SSE interrupted payload with every required field", () => {
    const parsed =
      conversationRunInterruptedResponseSchema.parse(interruptedBody);
    expect(parsed.interaction.interaction_id).toBe("run-1:document_selection");
    expect(isDocumentSelection(parsed.interaction)).toBe(true);
    if (!isDocumentSelection(parsed.interaction)) return;
    // The stream hands over the first page inline, so the card renders without
    // a round-trip.
    expect(parsed.interaction.options).toHaveLength(2);
    expect(parsed.interaction.reason_code).toBe("ambiguous_document_reference");
  });

  it("rejects a known-type interaction missing a contract-required field", () => {
    // Guards against quietly re-loosening the schema: both interrupt sources
    // send these, so an absence is drift worth failing on.
    const { reason_code, ...withoutReason } = interruptedBody.interaction;
    expect(reason_code).toBeTruthy();
    expect(
      pendingInteractionSchema.safeParse(withoutReason).success &&
        isDocumentSelection(pendingInteractionSchema.parse(withoutReason)),
    ).toBe(false);
  });

  it("discriminates a waiting run from a completed one by shape", () => {
    const waiting = conversationRunResultSchema.parse(interruptedBody);
    expect(isRunInterrupted(waiting)).toBe(true);

    const completed = conversationRunResultSchema.parse({
      status: "completed",
      run_id: "run-2",
      conversation_id: "c-1",
      reply: "답변입니다.",
      route: { label: "general_assistant", explanation: "일반 질문입니다." },
      handled_by: "personal_assistant_graph",
    });
    expect(isRunInterrupted(completed)).toBe(false);
  });

  it("parses a completed run that omits status entirely", () => {
    // `status` carries a server-side default and is not in `required`, which is
    // why the union is not discriminated on it.
    const completed = conversationRunResultSchema.parse({
      run_id: "run-3",
      conversation_id: "c-1",
      reply: "이전 버전 응답",
      route: { label: "general_assistant", explanation: "일반 질문입니다." },
      handled_by: "personal_assistant_graph",
    });
    expect(isRunInterrupted(completed)).toBe(false);
  });
});

describe("interaction schema versioning", () => {
  const v2Interaction = {
    ...interruptedBody.interaction,
    schema_version: INTERACTION_SCHEMA_VERSION + 1,
  };

  it("parses the supported version as the known type", () => {
    const parsed = pendingInteractionSchema.parse(interruptedBody.interaction);
    expect(isDocumentSelection(parsed)).toBe(true);
  });

  it("does not let a future version masquerade as the known type", () => {
    // The known branch is tried first, so a permissive version field would let
    // a v2 body render — and be answered — with v1 semantics. It must fall
    // through to the unsupported branch instead.
    const parsed = pendingInteractionSchema.parse(v2Interaction);
    expect(isDocumentSelection(parsed)).toBe(false);
    expect(parsed.type).toBe("document_selection");
    expect(parsed.schema_version).toBe(INTERACTION_SCHEMA_VERSION + 1);
  });

  it("keeps an unknown type parseable so its card can still cancel", () => {
    const parsed = pendingInteractionSchema.parse({
      schema_version: INTERACTION_SCHEMA_VERSION,
      interaction_id: "run-1:approval",
      type: "approval",
      expires_at: "2026-08-18T00:00:00Z",
    });
    expect(isDocumentSelection(parsed)).toBe(false);
    expect(parsed.interaction_id).toBe("run-1:approval");
  });

  it("refuses to send a resume body for an unsupported version", () => {
    expect(
      conversationRunResumeRequestSchema.safeParse({
        schema_version: INTERACTION_SCHEMA_VERSION,
        interaction_id: "run-1:document_selection",
        type: "document_selection",
        document_id: "doc-1",
      }).success,
    ).toBe(true);

    expect(
      conversationRunResumeRequestSchema.safeParse({
        schema_version: INTERACTION_SCHEMA_VERSION + 1,
        interaction_id: "run-1:document_selection",
        type: "document_selection",
        document_id: "doc-1",
      }).success,
    ).toBe(false);
  });

  it("rejects an options page from an unsupported version", () => {
    const page = {
      schema_version: INTERACTION_SCHEMA_VERSION,
      interaction_id: "run-1:document_selection",
      type: "document_selection",
      option_count: 0,
      options: [],
      next_cursor: null,
    };
    expect(documentSelectionOptionsPageSchema.safeParse(page).success).toBe(
      true,
    );
    expect(
      documentSelectionOptionsPageSchema.safeParse({
        ...page,
        schema_version: INTERACTION_SCHEMA_VERSION + 1,
      }).success,
    ).toBe(false);
  });

  it("defaults an absent options array rather than failing", () => {
    // Only `option_count` is required by the contract.
    const parsed = documentSelectionOptionsPageSchema.parse({
      schema_version: INTERACTION_SCHEMA_VERSION,
      interaction_id: "run-1:document_selection",
      type: "document_selection",
      option_count: 12,
    });
    expect(parsed.options).toEqual([]);
    expect(parsed.option_count).toBe(12);
  });
});
