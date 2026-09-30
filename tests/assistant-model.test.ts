import { describe, expect, it } from "vitest";
import { resolveAssistantModel } from "@/components/chat/assistant-model-selection";
import {
  type AssistantModelCapabilities,
  type AssistantPreferences,
  agentRunSummarySchema,
  assistantModelCapabilitiesSchema,
  conversationRunInterruptedResponseSchema,
  conversationRunRequestSchema,
  runStartedEventDataSchema,
} from "@/model/my-agents";
import { isAllowedBackendPath } from "@/server/my-agents/proxy-policy";
import { MyAgentsAssistantAPI } from "@/services/my-agents/MyAgentsAssistantAPI";

const capabilities: AssistantModelCapabilities = {
  customizable: true,
  default_model: "gpt-6-luna",
  models: [
    {
      id: "gpt-6-luna",
      name: "GPT-6 Luna",
      default_reasoning_effort: "medium",
      pro_supported: false,
    },
    {
      id: "gpt-6.1-sol",
      name: "GPT-6.1 Sol",
      default_reasoning_effort: "high",
      pro_supported: true,
    },
  ],
};

// The exposed catalog: the three models offered as choices, none of them
// the default. The backend still accepts all six supported IDs.
const exposedCatalog: AssistantModelCapabilities = {
  customizable: true,
  default_model: "gpt-5.6-sol",
  models: [
    {
      id: "gpt-6.1-sol",
      name: "GPT-6.1 Sol",
      default_reasoning_effort: "medium",
      pro_supported: true,
    },
    {
      id: "gpt-6-luna",
      name: "GPT-6 Luna",
      default_reasoning_effort: "medium",
      pro_supported: true,
    },
    {
      id: "gpt-6-astra",
      name: "GPT-6 Astra",
      default_reasoning_effort: "medium",
      pro_supported: true,
    },
  ],
};

const preferences: AssistantPreferences = {
  customizable: true,
  default_model: "gpt-6-luna",
  selected_model: null,
  effective_model: "gpt-6-luna",
};

describe("resolveAssistantModel", () => {
  it("hides the picker until both payloads have loaded", () => {
    expect(resolveAssistantModel(undefined, preferences, false).available).toBe(
      false,
    );
    expect(
      resolveAssistantModel(capabilities, undefined, false).available,
    ).toBe(false);
  });

  it("treats a null selection as following the deployment default", () => {
    const resolved = resolveAssistantModel(capabilities, preferences, false);
    expect(resolved.available).toBe(true);
    expect(resolved.locked).toBe(false);
    expect(resolved.selectedId).toBeNull();
    expect(resolved.defaultModel?.name).toBe("GPT-6 Luna");
    expect(resolved.effectiveModel?.name).toBe("GPT-6 Luna");
  });

  it("reports an explicit choice and the model runs will use", () => {
    const resolved = resolveAssistantModel(
      capabilities,
      {
        ...preferences,
        selected_model: "gpt-6.1-sol",
        effective_model: "gpt-6.1-sol",
      },
      false,
    );
    expect(resolved.selectedId).toBe("gpt-6.1-sol");
    expect(resolved.effectiveModel?.name).toBe("GPT-6.1 Sol");
  });

  it("offers exactly the served list, whatever its length", () => {
    // Nothing in the frontend enumerates models, so a deployment adding one
    // gets it in the picker without a release.
    const extended: AssistantModelCapabilities = {
      ...capabilities,
      models: [
        ...capabilities.models,
        {
          id: "future-model",
          name: "Future",
          default_reasoning_effort: "low",
          pro_supported: false,
        },
      ],
    };
    const resolved = resolveAssistantModel(extended, preferences, false);
    expect(resolved.models.map((model) => model.id)).toEqual([
      "gpt-6-luna",
      "gpt-6.1-sol",
      "future-model",
    ]);
  });

  it("locks a guest even if a payload claims otherwise", () => {
    const resolved = resolveAssistantModel(capabilities, preferences, true);
    expect(resolved.available).toBe(true);
    expect(resolved.locked).toBe(true);
  });

  it("locks when either payload says the session cannot customize", () => {
    expect(
      resolveAssistantModel(
        { ...capabilities, customizable: false },
        preferences,
        false,
      ).locked,
    ).toBe(true);
    expect(
      resolveAssistantModel(
        capabilities,
        { ...preferences, customizable: false },
        false,
      ).locked,
    ).toBe(true);
  });

  it("keeps the picker when the deployment default is not advertised", () => {
    // The catalog lists what a user may choose, not every model the backend
    // runs: the default can sit outside it, and it still answers.
    const resolved = resolveAssistantModel(
      exposedCatalog,
      {
        customizable: true,
        default_model: "gpt-5.6-sol",
        selected_model: null,
        effective_model: "gpt-5.6-sol",
      },
      false,
    );
    expect(resolved.available).toBe(true);
    expect(resolved.selectedId).toBeNull();
    expect(resolved.unlistedSelection).toBeNull();
    // Shown by ID, truthfully, because only catalog entries carry a name.
    expect(resolved.defaultModel).toEqual({
      id: "gpt-5.6-sol",
      name: "gpt-5.6-sol",
      listed: false,
    });
    expect(resolved.effectiveModel?.listed).toBe(false);
    // Only the served choices are options; the default is not added to them.
    expect(resolved.models.map((model) => model.id)).toEqual([
      "gpt-6.1-sol",
      "gpt-6-luna",
      "gpt-6-astra",
    ]);
  });

  it("preserves a saved model the catalog no longer advertises", () => {
    const resolved = resolveAssistantModel(
      exposedCatalog,
      {
        customizable: true,
        default_model: "gpt-5.6-sol",
        selected_model: "gpt-5.6-luna",
        effective_model: "gpt-5.6-luna",
      },
      false,
    );
    // Not collapsed to null: that would present it as the default setting.
    expect(resolved.selectedId).toBe("gpt-5.6-luna");
    expect(resolved.unlistedSelection).toEqual({
      id: "gpt-5.6-luna",
      name: "gpt-5.6-luna",
      listed: false,
    });
    expect(resolved.effectiveModel?.id).toBe("gpt-5.6-luna");
    expect(resolved.models.some((model) => model.id === "gpt-5.6-luna")).toBe(
      false,
    );
  });

  it("names a listed saved model from the catalog", () => {
    const resolved = resolveAssistantModel(
      exposedCatalog,
      {
        customizable: true,
        default_model: "gpt-5.6-sol",
        selected_model: "gpt-6-astra",
        effective_model: "gpt-6-astra",
      },
      false,
    );
    expect(resolved.unlistedSelection).toBeNull();
    expect(resolved.effectiveModel).toEqual({
      id: "gpt-6-astra",
      name: "GPT-6 Astra",
      listed: true,
    });
  });

  it("hides when there is nothing to choose", () => {
    expect(
      resolveAssistantModel(
        { ...exposedCatalog, models: [] },
        preferences,
        false,
      ).available,
    ).toBe(false);
  });
});

describe("MyAgentsAssistantAPI", () => {
  it("reads and saves the preference through one endpoint", async () => {
    const calls: Array<{ path: string; init?: unknown }> = [];
    const api = new MyAgentsAssistantAPI({
      fetch: async (path, init) => {
        calls.push({ path, init });
        return preferences;
      },
    });

    await api.getPreferences();
    await api.updatePreferences({ assistant_model: "gpt-6.1-sol" });
    await api.updatePreferences({ assistant_model: null });

    expect(calls).toEqual([
      { path: "/assistant/preferences", init: undefined },
      {
        path: "/assistant/preferences",
        init: { method: "PATCH", body: { assistant_model: "gpt-6.1-sol" } },
      },
      // `null` is sent, not omitted: it is the reset-to-default instruction.
      {
        path: "/assistant/preferences",
        init: { method: "PATCH", body: { assistant_model: null } },
      },
    ]);
  });
});

describe("assistant model schemas", () => {
  it("parses capabilities with the per-model reasoning default", () => {
    const parsed = assistantModelCapabilitiesSchema.parse(capabilities);
    expect(parsed.models[1].default_reasoning_effort).toBe("high");
  });

  it("keeps the run request free of a per-run model", () => {
    // The model is an account preference. A run body carrying it would imply
    // an override the backend does not offer.
    const parsed = conversationRunRequestSchema.parse({
      message: "hello",
      assistant_model: "gpt-6.1-sol",
    });
    expect("assistant_model" in parsed).toBe(false);
  });

  it("parses assistant_model on run responses, null for legacy runs", () => {
    const started = runStartedEventDataSchema.parse({
      run_id: "run-1",
      conversation_id: "c-1",
      status: "running",
      assistant_model: "gpt-6.1-sol",
    });
    expect(started.assistant_model).toBe("gpt-6.1-sol");

    const legacy = agentRunSummarySchema.parse({
      run_id: "run-0",
      conversation_id: "c-1",
      status: "completed",
      route_label: null,
      created_at: "2026-09-01T00:00:00Z",
      assistant_model: null,
    });
    expect(legacy.assistant_model).toBeNull();

    // A suspended run reports its pinned model too; resume reuses it.
    const interrupted = conversationRunInterruptedResponseSchema
      .pick({ assistant_model: true })
      .parse({ assistant_model: "gpt-6-astra" });
    expect(interrupted.assistant_model).toBe("gpt-6-astra");
  });
});

describe("assistant preference proxy policy", () => {
  it("allows exactly the preference and model-list routes", () => {
    expect(isAllowedBackendPath("GET", "/assistant/preferences")).toMatchObject(
      { allowed: true, params: { route: "assistant.preferences" } },
    );
    expect(
      isAllowedBackendPath("PATCH", "/assistant/preferences"),
    ).toMatchObject({
      allowed: true,
      params: { route: "assistant.preferences.update" },
    });
    expect(
      isAllowedBackendPath("GET", "/capabilities/assistant-models"),
    ).toMatchObject({ allowed: true });
  });

  it("keeps the rest of the legacy assistant prefix closed", () => {
    for (const path of [
      "/assistant/chat",
      "/assistant/preferences/extra",
      "/assistant/other",
    ]) {
      expect(isAllowedBackendPath("POST", path)).toMatchObject({
        allowed: false,
        code: "legacy_chat_blocked",
      });
    }
    expect(
      isAllowedBackendPath("POST", "/assistant/preferences"),
    ).toMatchObject({ allowed: false, code: "path_not_allowed" });
  });
});
