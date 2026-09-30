import type {
  AssistantModelCapabilities,
  AssistantModelId,
  AssistantModelOption,
  AssistantPreferences,
} from "@/model/my-agents";

/**
 * A model as the UI refers to it. `listed` is whether the served catalog
 * offers it as a choice.
 *
 * The catalog serves the *exposed* models — the ones a user may choose — not
 * every model the backend supports (backend `EXPOSED_ASSISTANT_MODELS` is a
 * subset of `SUPPORTED_ASSISTANT_MODELS`). The deployment default, and a
 * preference saved earlier, can both be supported but unexposed. Those are
 * still the truth about which model answers, so they are shown — read-only,
 * by ID, since only catalog entries carry a display name — and never offered
 * as a radio option.
 */
export type AssistantModelRef = {
  id: AssistantModelId;
  name: string;
  listed: boolean;
};

/**
 * What the model picker may show and offer.
 *
 * Pure so the rules are testable without a browser. Every option, label, and
 * default comes from the two served payloads; a missing payload hides the
 * picker rather than inventing a list.
 */
export type ResolvedAssistantModel = {
  available: boolean;
  /** Render, but not interactive: guests and non-customizable sessions. */
  locked: boolean;
  /** The choices, exactly as served and in served order. */
  models: AssistantModelOption[];
  /**
   * The saved choice; `null` follows the deployment default. Kept even when
   * the catalog does not list it — mapping it to `null` would present a
   * saved model as "default", which is a different setting.
   */
  selectedId: AssistantModelId | null;
  /** The saved choice when it is not a listed option; shown read-only. */
  unlistedSelection: AssistantModelRef | null;
  defaultModel: AssistantModelRef | null;
  /** The model new runs will use, as served by preferences. */
  effectiveModel: AssistantModelRef | null;
};

const UNAVAILABLE: ResolvedAssistantModel = {
  available: false,
  locked: false,
  models: [],
  selectedId: null,
  unlistedSelection: null,
  defaultModel: null,
  effectiveModel: null,
};

function toRef(
  models: AssistantModelOption[],
  id: AssistantModelId,
): AssistantModelRef {
  const model = models.find((candidate) => candidate.id === id);
  return model
    ? { id, name: model.name, listed: true }
    : { id, name: id, listed: false };
}

export function resolveAssistantModel(
  capabilities: AssistantModelCapabilities | undefined,
  preferences: AssistantPreferences | undefined,
  isGuest: boolean,
): ResolvedAssistantModel {
  if (!capabilities || !preferences) return UNAVAILABLE;
  const { models } = capabilities;
  // Nothing to choose and nothing but the default to reset to: no picker.
  if (models.length === 0) return UNAVAILABLE;

  const selectedId = preferences.selected_model;
  const selected = selectedId ? toRef(models, selectedId) : null;

  return {
    available: true,
    locked: isGuest || !capabilities.customizable || !preferences.customizable,
    models,
    selectedId,
    unlistedSelection: selected && !selected.listed ? selected : null,
    defaultModel: toRef(models, preferences.default_model),
    effectiveModel: toRef(models, preferences.effective_model),
  };
}
