import type {
  AssistantModelCapabilities,
  AssistantModelOption,
  AssistantPreferences,
} from "@/model/my-agents";

/**
 * Shared shapes for every account-level model preference — the answer model
 * today, the summarization model next. Both serve a catalog of choices and a
 * preferences payload with the same four fields; only the catalog entries
 * differ (the summarization catalog carries `id` and `name` alone), so the
 * rules here depend on nothing else.
 */
export type ModelOptionLike = { id: string; name: string };

export type ModelCatalogLike<T extends ModelOptionLike> = {
  customizable: boolean;
  models: T[];
};

export type ModelPreferencesLike = {
  customizable: boolean;
  default_model: string;
  /** `null` means "follow the deployment default", not "no model". */
  selected_model: string | null;
  effective_model: string;
};

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
export type ModelRef = {
  id: string;
  name: string;
  listed: boolean;
};

/**
 * What a model picker may show and offer.
 *
 * Pure so the rules are testable without a browser. Every option, label, and
 * default comes from the two served payloads; a missing payload hides the
 * picker rather than inventing a list.
 */
export type ResolvedModelPreference<
  T extends ModelOptionLike = ModelOptionLike,
> = {
  available: boolean;
  /** Render, but not interactive: guests and non-customizable sessions. */
  locked: boolean;
  /** The choices, exactly as served and in served order. */
  models: T[];
  /**
   * The saved choice; `null` follows the deployment default. Kept even when
   * the catalog does not list it — mapping it to `null` would present a saved
   * model as "default", which is a different setting.
   */
  selectedId: string | null;
  /** The saved choice when it is not a listed option; shown read-only. */
  unlistedSelection: ModelRef | null;
  defaultModel: ModelRef | null;
  /** The model new runs will use, as served by preferences. */
  effectiveModel: ModelRef | null;
};

function toRef<T extends ModelOptionLike>(models: T[], id: string): ModelRef {
  const model = models.find((candidate) => candidate.id === id);
  return model
    ? { id, name: model.name, listed: true }
    : { id, name: id, listed: false };
}

export function resolveModelPreference<T extends ModelOptionLike>(
  catalog: ModelCatalogLike<T> | undefined,
  preferences: ModelPreferencesLike | undefined,
  isGuest: boolean,
): ResolvedModelPreference<T> {
  // Nothing to choose and nothing but the default to reset to: no picker.
  if (!catalog || !preferences || catalog.models.length === 0) {
    return {
      available: false,
      locked: false,
      models: [],
      selectedId: null,
      unlistedSelection: null,
      defaultModel: null,
      effectiveModel: null,
    };
  }
  const { models } = catalog;
  const selectedId = preferences.selected_model;
  const selected = selectedId ? toRef(models, selectedId) : null;

  return {
    available: true,
    locked: isGuest || !catalog.customizable || !preferences.customizable,
    models,
    selectedId,
    unlistedSelection: selected && !selected.listed ? selected : null,
    defaultModel: toRef(models, preferences.default_model),
    effectiveModel: toRef(models, preferences.effective_model),
  };
}

export type AssistantModelRef = ModelRef;
export type ResolvedAssistantModel =
  ResolvedModelPreference<AssistantModelOption>;

export function resolveAssistantModel(
  capabilities: AssistantModelCapabilities | undefined,
  preferences: AssistantPreferences | undefined,
  isGuest: boolean,
): ResolvedAssistantModel {
  return resolveModelPreference(capabilities, preferences, isGuest);
}
