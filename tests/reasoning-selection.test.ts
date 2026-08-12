import { describe, expect, it } from "vitest";
import {
  REASONING_STORAGE_KEY,
  readStoredReasoning,
  resolveReasoning,
} from "@/components/chat/reasoning-selection";
import {
  type ReasoningCapabilities,
  reasoningCapabilitiesSchema,
} from "@/model/my-agents";

const capabilities: ReasoningCapabilities = {
  customizable: true,
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
};

describe("resolveReasoning", () => {
  it("sends nothing when the backend has not confirmed support", () => {
    // The deployed backend 404s this endpoint until the reasoning migration
    // lands, and the request body must then match what shipped before.
    const resolved = resolveReasoning(undefined, null, false);
    expect(resolved.available).toBe(false);
    expect(resolved.selection).toBeNull();
  });

  it("falls back to served defaults with no stored preference", () => {
    const resolved = resolveReasoning(capabilities, null, false);
    expect(resolved.selection).toEqual({ mode: "standard", effort: "medium" });
    expect(resolved.locked).toBe(false);
  });

  it("restores a stored preference", () => {
    const resolved = resolveReasoning(
      capabilities,
      { mode: "pro", effort: "high" },
      false,
    );
    expect(resolved.selection).toEqual({ mode: "pro", effort: "high" });
  });

  it("drops a stored effort the backend no longer offers", () => {
    // A redeploy can shorten the list. Sending a level that is no longer in the
    // enum would be rejected, so the served default wins over stale storage.
    const narrowed: ReasoningCapabilities = {
      ...capabilities,
      supported_efforts: ["low", "medium", "high"],
    };
    const resolved = resolveReasoning(narrowed, { effort: "max" }, false);
    expect(resolved.selection?.effort).toBe("medium");
  });

  it("downgrades a stored pro preference when the model cannot serve it", () => {
    // The backend answers 400 reasoning_mode_not_supported for this pair, so
    // the UI must not send it just because storage remembers it.
    const noPro: ReasoningCapabilities = {
      ...capabilities,
      chat: { pro_supported: false },
    };
    const resolved = resolveReasoning(noPro, { mode: "pro" }, false);
    expect(resolved.selection?.mode).toBe("standard");
    expect(resolved.proSupported).toBe(false);
  });

  it("locks a guest to the served defaults and ignores storage", () => {
    // Guests are clamped server-side; the UI shows the real values rather than
    // implying a choice that would be discarded.
    const resolved = resolveReasoning(
      capabilities,
      { mode: "pro", effort: "max" },
      true,
    );
    expect(resolved.locked).toBe(true);
    expect(resolved.available).toBe(true);
    expect(resolved.selection).toEqual({ mode: "standard", effort: "medium" });
  });

  it("locks when the backend reports the session cannot customize", () => {
    const resolved = resolveReasoning(
      { ...capabilities, customizable: false },
      { effort: "max" },
      false,
    );
    expect(resolved.locked).toBe(true);
    expect(resolved.selection?.effort).toBe("medium");
  });

  it("hides itself when the served level list is empty", () => {
    const resolved = resolveReasoning(
      { ...capabilities, supported_efforts: [] },
      null,
      false,
    );
    expect(resolved.available).toBe(false);
  });
});

describe("readStoredReasoning", () => {
  function storage(value: string | null) {
    return { getItem: () => value };
  }

  it("returns null without storage", () => {
    expect(readStoredReasoning(undefined)).toBeNull();
  });

  it("returns null for absent or unparseable values", () => {
    expect(readStoredReasoning(storage(null))).toBeNull();
    expect(readStoredReasoning(storage("{not json"))).toBeNull();
    expect(readStoredReasoning(storage('"a string"'))).toBeNull();
  });

  it("reads a stored pair", () => {
    expect(
      readStoredReasoning(
        storage(JSON.stringify({ mode: "pro", effort: "high" })),
      ),
    ).toEqual({ mode: "pro", effort: "high" });
  });

  it("survives hand-edited storage without throwing", () => {
    // Values are validated against served capabilities by resolveReasoning, so
    // this only has to avoid crashing on nonsense.
    expect(
      readStoredReasoning(storage(JSON.stringify({ mode: 7, effort: [] }))),
    ).toEqual({ mode: undefined, effort: undefined });
  });

  it("uses a namespaced key so it cannot collide with other app storage", () => {
    expect(REASONING_STORAGE_KEY).toMatch(/^my-agents\./);
  });
});

describe("reasoningCapabilitiesSchema", () => {
  const payloadWithoutModel = {
    customizable: true,
    default_mode: "standard",
    default_effort: "medium",
    supported_modes: ["standard", "pro"],
    supported_efforts: ["low", "medium", "high"],
    chat: { pro_supported: true },
    document_workspace: { pro_supported: false },
  };

  it("parses a payload with no model field", () => {
    // The target contract, once the backend has dropped the raw model IDs.
    const parsed = reasoningCapabilitiesSchema.parse(payloadWithoutModel);
    expect(parsed.chat.pro_supported).toBe(true);
  });

  it("strips model instead of rejecting it, so either repo may deploy first", () => {
    // This is the property the whole rollout rests on. The schema is not
    // `.strict()`, so a backend that still reports model parses cleanly and the
    // value is dropped rather than retained. Adding `.strict()` here would turn
    // a compatible deploy into a hard failure that errors the capabilities
    // query and silently strips the composer's reasoning controls.
    const parsed = reasoningCapabilitiesSchema.parse({
      ...payloadWithoutModel,
      chat: { model: "gpt-5.6-sol", pro_supported: true },
      document_workspace: { model: "gpt-5.6-sol", pro_supported: false },
    });
    expect(parsed.chat.pro_supported).toBe(true);
    expect("model" in parsed.chat).toBe(false);
    expect("model" in parsed.document_workspace).toBe(false);
  });

  it("falls back to standard when default_mode is absent", () => {
    // `default_mode` is the one field the backend does not mark required — it
    // is a Pydantic field with a default, so it is always sent today. This
    // covers the endpoint ever being switched to omit unset fields, which would
    // otherwise fail the whole schema and strip the reasoning controls.
    const { default_mode: _omitted, ...withoutMode } = payloadWithoutModel;
    const parsed = reasoningCapabilitiesSchema.parse(withoutMode);
    expect(parsed.default_mode).toBe("standard");
  });

  it("keeps the fallback conservative rather than enabling pro", () => {
    // Falling back may only ever downgrade. Silently defaulting to `pro` would
    // send a more expensive mode the session never asked for, and one the
    // backend may reject outright.
    const { default_mode: _omitted, ...withoutMode } = payloadWithoutModel;
    const resolved = resolveReasoning(
      reasoningCapabilitiesSchema.parse(withoutMode),
      null,
      false,
    );
    expect(resolved.selection?.mode).toBe("standard");
  });

  it("keeps pro_supported required per surface", () => {
    // Independently configured surfaces: the backend validates an attachment
    // run against the document-workspace model. A missing flag must fail loudly
    // rather than default to offering Pro.
    expect(() =>
      reasoningCapabilitiesSchema.parse({
        ...payloadWithoutModel,
        chat: {},
      }),
    ).toThrow();
  });
});
