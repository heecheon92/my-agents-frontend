import { describe, expect, it } from "vitest";
import {
  classifyInteraction,
  registeredInteractionTypes,
  resolveInteractionRenderer,
  SUPPORTED_INTERACTION_PROTOCOL_MAJOR,
} from "@/components/chat/interactions/registry";

const FALLBACK = "fallback" as const;
const registry = { document_selection: "document-card" } as const;

describe("interaction renderer registry", () => {
  it("resolves a registered type", () => {
    expect(
      resolveInteractionRenderer(registry, "document_selection", FALLBACK),
    ).toBe("document-card");
  });

  it("never resolves to nothing", () => {
    // The run behind an unrenderable interaction is suspended. With no card
    // there is no cancel affordance, and the conversation stays unusable until
    // the interaction expires — 24 hours by backend default. A visible
    // dead-end is recoverable; a blank one is not.
    expect(resolveInteractionRenderer(registry, "unknown_type", FALLBACK)).toBe(
      FALLBACK,
    );
    expect(resolveInteractionRenderer({}, "document_selection", FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("does not resolve inherited object properties as renderers", () => {
    // `registry[type]` with an attacker- or backend-controlled string would
    // otherwise return `Object.prototype.constructor` for "constructor" and
    // render something that is not a component at all.
    expect(resolveInteractionRenderer(registry, "constructor", FALLBACK)).toBe(
      FALLBACK,
    );
    expect(resolveInteractionRenderer(registry, "toString", FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("lists what it can render", () => {
    expect(registeredInteractionTypes(registry)).toEqual([
      "document_selection",
    ]);
  });
});

describe("interaction protocol classification", () => {
  const known = ["document_selection"];

  it("accepts a known type on the supported major", () => {
    expect(
      classifyInteraction(
        {
          type: "document_selection",
          major: SUPPORTED_INTERACTION_PROTOCOL_MAJOR,
        },
        known,
      ),
    ).toEqual({ support: "supported", type: "document_selection" });
  });

  it("separates an unknown type from an unknown protocol version", () => {
    // The remedies differ: a newer major means "reload for a newer app", an
    // unknown type within a understood major means there is nothing the user
    // can do but dismiss. Collapsing them would give one of the two wrong copy.
    expect(
      classifyInteraction(
        { type: "approval", major: SUPPORTED_INTERACTION_PROTOCOL_MAJOR },
        known,
      ),
    ).toEqual({ support: "unsupported_type", type: "approval" });

    expect(
      classifyInteraction(
        {
          type: "document_selection",
          major: SUPPORTED_INTERACTION_PROTOCOL_MAJOR + 1,
        },
        known,
      ),
    ).toEqual({
      support: "unsupported_version",
      type: "document_selection",
      major: SUPPORTED_INTERACTION_PROTOCOL_MAJOR + 1,
    });
  });

  it("treats an older major as unsupported too", () => {
    // A backend rolled back below our floor is as unrenderable as one ahead of
    // it, and silently trying to parse it is how a half-populated card ships.
    expect(
      classifyInteraction(
        {
          type: "document_selection",
          major: SUPPORTED_INTERACTION_PROTOCOL_MAJOR - 1,
        },
        known,
      ).support,
    ).toBe("unsupported_version");
  });

  it("accepts a Set of known types as well as an array", () => {
    expect(
      classifyInteraction(
        {
          type: "document_selection",
          major: SUPPORTED_INTERACTION_PROTOCOL_MAJOR,
        },
        new Set(known),
      ).support,
    ).toBe("supported");
  });
});
