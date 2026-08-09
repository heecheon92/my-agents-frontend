import type {
  ReasoningCapabilities,
  ReasoningEffort,
  ReasoningMode,
} from "@/model/my-agents";

export const REASONING_STORAGE_KEY = "my-agents.reasoning-preference";

export type ReasoningSelection = {
  mode: ReasoningMode;
  effort: ReasoningEffort;
};

/**
 * What the composer should actually send, and whether it may offer controls.
 *
 * Kept pure and exported so the precedence rules are testable without a
 * browser: they decide what reaches a paid API call, and getting them wrong is
 * either a silent cost increase or a request the backend will reject.
 */
export type ResolvedReasoning = {
  /** Render controls at all. */
  available: boolean;
  /** Render them, but not interactive, with a reason. */
  locked: boolean;
  selection: ReasoningSelection | null;
  efforts: ReasoningEffort[];
  /** `pro` is offered only where the configured chat model supports it. */
  proSupported: boolean;
};

const UNAVAILABLE: ResolvedReasoning = {
  available: false,
  locked: false,
  selection: null,
  efforts: [],
  proSupported: false,
};

export function resolveReasoning(
  capabilities: ReasoningCapabilities | undefined,
  stored: Partial<ReasoningSelection> | null,
  isGuest: boolean,
): ResolvedReasoning {
  // No capabilities means a backend without the feature, a 404, or a failed
  // fetch. Send nothing and show nothing — the request body then matches what
  // this app sent before reasoning controls existed.
  if (!capabilities) return UNAVAILABLE;

  const efforts = capabilities.supported_efforts;
  if (efforts.length === 0) return UNAVAILABLE;

  const proSupported =
    capabilities.chat.pro_supported &&
    capabilities.supported_modes.includes("pro");

  // A guest is clamped server-side regardless of what is sent. Showing the
  // controls as locked is honest; hiding them would imply the product lacks
  // the feature rather than that this session cannot use it.
  if (isGuest || !capabilities.customizable) {
    return {
      available: true,
      locked: true,
      selection: {
        mode: capabilities.default_mode,
        effort: capabilities.default_effort,
      },
      efforts,
      proSupported,
    };
  }

  // A stored effort can outlive the backend that offered it — a redeploy may
  // drop a level. Fall back rather than sending a value that no longer parses.
  const storedEffort =
    stored?.effort && efforts.includes(stored.effort) ? stored.effort : null;
  const storedMode =
    stored?.mode && capabilities.supported_modes.includes(stored.mode)
      ? stored.mode
      : null;

  return {
    available: true,
    locked: false,
    selection: {
      mode:
        storedMode === "pro" && !proSupported
          ? "standard"
          : (storedMode ?? capabilities.default_mode),
      effort: storedEffort ?? capabilities.default_effort,
    },
    efforts,
    proSupported,
  };
}

/** Tolerates absent, malformed, or hand-edited storage without throwing. */
export function readStoredReasoning(
  storage: Pick<Storage, "getItem"> | undefined,
): Partial<ReasoningSelection> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(REASONING_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { mode, effort } = parsed as Record<string, unknown>;
    return {
      mode: typeof mode === "string" ? (mode as ReasoningMode) : undefined,
      effort:
        typeof effort === "string" ? (effort as ReasoningEffort) : undefined,
    };
  } catch {
    return null;
  }
}
