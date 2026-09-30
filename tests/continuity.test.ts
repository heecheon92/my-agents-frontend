import { describe, expect, it } from "vitest";
import { resolveModelPreference } from "@/components/chat/assistant-model-selection";
import { describeRetention } from "@/components/chat/attachments/staging";
import { getAgentProcessState } from "@/components/chat/evidence-panel/trace";
import {
  decideAdmission,
  isAmbiguousPreAdmissionFailure,
  newClientRequestId,
} from "@/components/chat/workspace-helpers";
import {
  conversationRunRequestSchema,
  conversationRunResumeRequestSchema,
  documentWorkspaceCapabilitySchema,
  isAttachmentSelection,
  isDocumentSelection,
  messageSchema,
  pendingInteractionSchema,
  summarizationModelCapabilitiesSchema,
  summarizationPreferencesSchema,
} from "@/model/my-agents";
import { MyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";

/** Shaped from the served `PendingAttachmentSelection`. */
const attachmentSelection = {
  schema_version: 2,
  interaction_id: "run-1:attachment_selection",
  type: "attachment_selection",
  reason_code: "ambiguous_attachment_reference",
  message_key: "clarification.attachment_scope.select_source",
  expires_at: "2030-01-01T00:00:00Z",
  option_count: 2,
  options: [
    {
      attachment_id: "att-1",
      filename: "q3.xlsx",
      category: "spreadsheet",
      original_available: true,
    },
    {
      attachment_id: "att-2",
      filename: "chart.png",
      category: "image",
      original_available: false,
    },
  ],
};

describe("attachment_selection interaction", () => {
  it("parses as a supported V2 interaction", () => {
    const parsed = pendingInteractionSchema.parse(attachmentSelection);
    expect(isAttachmentSelection(parsed)).toBe(true);
    expect(isDocumentSelection(parsed)).toBe(false);
  });

  it("reads option size and notes-only access, defaulting access to original", () => {
    const parsed = pendingInteractionSchema.parse({
      ...attachmentSelection,
      access: "notes",
      options: [
        {
          ...attachmentSelection.options[0],
          byte_size: 2048,
          created_at: null,
        },
      ],
    });
    if (!isAttachmentSelection(parsed)) throw new Error("not supported");
    expect(parsed.access).toBe("notes");
    expect(parsed.options[0].byte_size).toBe(2048);
    const legacy = pendingInteractionSchema.parse(attachmentSelection);
    if (!isAttachmentSelection(legacy)) throw new Error("not supported");
    expect(legacy.access).toBe("original");
  });

  it("falls back for a future version instead of masquerading as V2", () => {
    // Type alone is not a support decision: a V3 body keeps its type but
    // parses through the unsupported branch, which strips `options`.
    const parsed = pendingInteractionSchema.parse({
      ...attachmentSelection,
      schema_version: 3,
    });
    expect(isAttachmentSelection(parsed)).toBe(false);
    expect(parsed.type).toBe("attachment_selection");
  });

  it("accepts one to three attachment IDs on resume, no more", () => {
    const base = {
      schema_version: 2,
      interaction_id: "run-1:attachment_selection",
      type: "attachment_selection",
      kind: "select",
    };
    expect(
      conversationRunResumeRequestSchema.parse({
        ...base,
        attachment_ids: ["att-1", "att-2"],
      }),
    ).toMatchObject({ attachment_ids: ["att-1", "att-2"] });
    for (const attachment_ids of [[], ["a", "b", "c", "d"]]) {
      expect(() =>
        conversationRunResumeRequestSchema.parse({ ...base, attachment_ids }),
      ).toThrow();
    }
  });
});

describe("decideAdmission", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const known = new Set(["run-old"]);

  it("admits the run that echoes this send's ID", () => {
    expect(
      decideAdmission({
        knownRunIds: known,
        runs: [{ run_id: "run-new", client_request_id: id }],
        clientRequestId: id,
      }),
    ).toBe("admitted");
  });

  it("reports not admitted when no new run exists", () => {
    expect(
      decideAdmission({
        knownRunIds: known,
        runs: [{ run_id: "run-old", client_request_id: null }],
        clientRequestId: id,
      }),
    ).toBe("not_admitted");
  });

  it("does not claim another send's identical run", () => {
    // The case text matching got wrong: same message, different send.
    expect(
      decideAdmission({
        knownRunIds: known,
        runs: [
          {
            run_id: "run-other-tab",
            client_request_id: "22222222-2222-4222-8222-222222222222",
          },
        ],
        clientRequestId: id,
      }),
    ).toBe("not_admitted");
  });

  it("stays unknown when a new run carries no ID", () => {
    // A legacy backend: never release files on a guess.
    expect(
      decideAdmission({
        knownRunIds: known,
        runs: [{ run_id: "run-new", client_request_id: null }],
        clientRequestId: id,
      }),
    ).toBe("unknown");
  });

  it("stays unknown without a baseline, unless the ID itself is found", () => {
    expect(
      decideAdmission({
        knownRunIds: null,
        runs: [{ run_id: "run-new" }],
        clientRequestId: id,
      }),
    ).toBe("unknown");
    expect(
      decideAdmission({
        knownRunIds: null,
        runs: [{ run_id: "run-new", client_request_id: id }],
        clientRequestId: id,
      }),
    ).toBe("admitted");
  });
});

describe("newClientRequestId", () => {
  it("mints distinct v4 UUIDs the request schema accepts", () => {
    const first = newClientRequestId();
    const second = newClientRequestId();
    expect(first).not.toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(
      conversationRunRequestSchema.parse({
        message: "hi",
        client_request_id: first,
      }).client_request_id,
    ).toBe(first);
  });
});

describe("isAmbiguousPreAdmissionFailure", () => {
  it("treats a dropped connection as ambiguous", () => {
    expect(isAmbiguousPreAdmissionFailure(new TypeError("network"))).toBe(true);
    expect(isAmbiguousPreAdmissionFailure(new Error("stream ended"))).toBe(
      true,
    );
  });

  it("treats an HTTP answer as a definite refusal", () => {
    expect(
      isAmbiguousPreAdmissionFailure(
        new MyAgentsAPIError({ message: "no", status: 503 }),
      ),
    ).toBe(false);
  });
});

describe("describeRetention", () => {
  const units = { days: "{n}일", hours: "{n}시간" };

  it("words a served period in whole days or hours", () => {
    expect(describeRetention(604_800, units)).toBe("7일");
    expect(describeRetention(7_200, units)).toBe("2시간");
  });

  it("invents nothing when the backend serves no period", () => {
    expect(describeRetention(undefined, units)).toBeNull();
  });
});

describe("summarization model preference", () => {
  const catalog = summarizationModelCapabilitiesSchema.parse({
    customizable: true,
    default_model: "gpt-6-luna",
    recommended_model: "gpt-6-luna",
    models: [
      { id: "gpt-6.1-sol", name: "GPT-6.1 Sol" },
      { id: "gpt-6-luna", name: "GPT-6 Luna" },
      { id: "gpt-6-astra", name: "GPT-6 Astra" },
    ],
  });

  it("resolves an id/name-only catalog with the shared rules", () => {
    const resolved = resolveModelPreference(
      catalog,
      summarizationPreferencesSchema.parse({
        customizable: true,
        default_model: "gpt-6-luna",
        selected_model: "gpt-6.1-sol",
        effective_model: "gpt-6.1-sol",
      }),
      false,
    );
    expect(resolved.available).toBe(true);
    expect(resolved.effectiveModel?.name).toBe("GPT-6.1 Sol");
    expect(catalog.recommended_model).toBe("gpt-6-luna");
  });

  it("locks a guest", () => {
    const resolved = resolveModelPreference(
      { ...catalog, customizable: false },
      {
        customizable: false,
        default_model: "gpt-6-luna",
        selected_model: null,
        effective_model: "gpt-6-luna",
      },
      true,
    );
    expect(resolved.locked).toBe(true);
  });
});

describe("served retention and message attachments", () => {
  it("parses retention fields and defaults recall to off", () => {
    const base = {
      enabled: true,
      eligible: true,
      model: "m",
      registry_verified_at: "2026-09-30",
      limits: {
        max_files_per_run: 3,
        max_combined_bytes: 1000,
        workspace_idle_ttl_seconds: 1200,
      },
      formats: [],
    };
    expect(
      documentWorkspaceCapabilitySchema.parse(base).automatic_recall_supported,
    ).toBe(false);
    const served = documentWorkspaceCapabilitySchema.parse({
      ...base,
      original_file_ttl_seconds: 604_800,
      notes_retention: "conversation",
      automatic_recall_supported: true,
    });
    expect(served.original_file_ttl_seconds).toBe(604_800);
    expect(served.automatic_recall_supported).toBe(true);
  });

  it("gives a legacy message an empty attachment list", () => {
    expect(
      messageSchema.parse({
        id: "m1",
        conversation_id: "c1",
        role: "user",
        content: "hi",
      }).attachments,
    ).toEqual([]);
  });
});

describe("run_model_resolved", () => {
  it("is bookkeeping, not observed work", () => {
    const state = getAgentProcessState({
      events: [
        { id: "e1", sequence: 1, event_type: "run_started", payload: {} },
        {
          id: "e2",
          sequence: 2,
          event_type: "run_model_resolved",
          payload: {
            assistant_model: "gpt-6-luna",
            reasoning_mode: "standard",
            reasoning_effort: "medium",
          },
        },
      ],
      citationCount: 0,
      isStreaming: true,
    });
    expect(state.stages).toEqual([]);
  });
});
