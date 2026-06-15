import type { AgentEvent, AgentTraceStep } from "@/model/my-agents";
import type { ChatLocalization, LiveActivityEvent } from "../types";

export type AgentTraceStageKey =
  | "planning"
  | "searchingKnowledge"
  | "draftingAnswer"
  | "checkingCitations"
  | "answerReady"
  | "needsEvidence";

const AGENT_TRACE_STAGE_ORDER: AgentTraceStageKey[] = [
  "planning",
  "searchingKnowledge",
  "draftingAnswer",
  "checkingCitations",
  "answerReady",
  "needsEvidence",
];

const INTERNAL_ACTIVITY_PAYLOAD_KEYS = new Set([
  "handled_by",
  "retrieval_route",
  "route",
  "route_label",
]);

const BACKEND_TRACE_STAGE_MAP: Partial<Record<string, AgentTraceStageKey>> = {
  query_cartographer: "planning",
  source_warden: "planning",
  candidate_scouts: "searchingKnowledge",
  context_curator: "searchingKnowledge",
  evidence_judge: "checkingCitations",
  assistant_graph: "draftingAnswer",
};

export function sanitizeActivityEventPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeActivityEventPayload);
  }
  if (!value || typeof value !== "object") return value;

  const sanitizedEntries = Object.entries(value)
    .filter(([key]) => !INTERNAL_ACTIVITY_PAYLOAD_KEYS.has(key))
    .map(([key, entryValue]) => [
      key,
      sanitizeActivityEventPayload(entryValue),
    ]);

  return Object.fromEntries(sanitizedEntries);
}

export function formatActivityEventPayload(
  value: unknown,
  fallbackLabel: string,
) {
  const sanitized = sanitizeActivityEventPayload(value);
  if (
    sanitized &&
    typeof sanitized === "object" &&
    !Array.isArray(sanitized) &&
    Object.keys(sanitized).length === 0
  ) {
    return fallbackLabel;
  }
  return JSON.stringify(sanitized, null, 2);
}

function collectPayloadKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectPayloadKeys);
  }
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectPayloadKeys(child),
  ]);
}

function activityEventSearchText(
  event: AgentEvent | LiveActivityEvent,
): string {
  return [event.event_type, ...collectPayloadKeys(event.payload)]
    .join(" ")
    .toLowerCase();
}

function eventMatchesAny(
  event: AgentEvent | LiveActivityEvent,
  patterns: RegExp[],
) {
  const searchText = activityEventSearchText(event);
  return patterns.some((pattern) => pattern.test(searchText));
}

export function getAgentTraceStageKeys({
  events,
  citationCount,
}: {
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
}): AgentTraceStageKey[] {
  if (events.length === 0) return [];

  const hasInsufficientEvidence = events.some((event) =>
    payloadHasBooleanFlag(event.payload, "insufficient_evidence"),
  );
  const hasUnreadyTerminalEvent = events.some((event) =>
    /(^|_)run_(failed|cancelled|error)$|\b(failed|cancelled|error)\b/.test(
      event.event_type.toLowerCase(),
    ),
  );
  const explicitStageKeys = stageKeysFromBackendAgentTrace(events, {
    hasInsufficientEvidence,
    hasUnreadyTerminalEvent,
  });
  if (explicitStageKeys.length > 0) return explicitStageKeys;

  const stageKeys = new Set<AgentTraceStageKey>(["planning"]);
  const hasCompletedEvent = events.some((event) =>
    /(^|_)run_completed$|\bcompleted\b/.test(event.event_type.toLowerCase()),
  );

  if (
    citationCount > 0 ||
    events.some((event) =>
      eventMatchesAny(event, [
        /search/,
        /retriev/,
        /knowledge/,
        /context/,
        /source/,
      ]),
    )
  ) {
    stageKeys.add("searchingKnowledge");
  }

  if (
    hasCompletedEvent ||
    events.some((event) => eventMatchesAny(event, [/answer/, /delta/, /draft/]))
  ) {
    stageKeys.add("draftingAnswer");
  }

  if (
    hasCompletedEvent ||
    citationCount > 0 ||
    events.some((event) =>
      eventMatchesAny(event, [/citation/, /evidence/, /verify/, /check/]),
    )
  ) {
    stageKeys.add("checkingCitations");
  }

  if (hasInsufficientEvidence || hasUnreadyTerminalEvent) {
    stageKeys.add("needsEvidence");
  } else if (hasCompletedEvent) {
    stageKeys.add("answerReady");
  }

  return AGENT_TRACE_STAGE_ORDER.filter((stageKey) => stageKeys.has(stageKey));
}

function stageKeysFromBackendAgentTrace(
  events: Array<AgentEvent | LiveActivityEvent>,
  {
    hasInsufficientEvidence,
    hasUnreadyTerminalEvent,
  }: { hasInsufficientEvidence: boolean; hasUnreadyTerminalEvent: boolean },
): AgentTraceStageKey[] {
  const stageKeys = new Set<AgentTraceStageKey>();
  let hasCompletedAnswerComposer = false;
  for (const step of events.flatMap((event) =>
    agentTraceStepsFromPayload(event.payload),
  )) {
    if (step.status === "skipped") continue;
    if (step.id === "answer_composer") {
      hasCompletedAnswerComposer = step.status === "completed";
      stageKeys.add(
        hasCompletedAnswerComposer && !hasInsufficientEvidence
          ? "answerReady"
          : "needsEvidence",
      );
      continue;
    }
    const stageKey = BACKEND_TRACE_STAGE_MAP[step.id];
    if (stageKey) stageKeys.add(stageKey);
  }
  if (
    (hasInsufficientEvidence ||
      (hasUnreadyTerminalEvent && !hasCompletedAnswerComposer)) &&
    stageKeys.size > 0
  ) {
    stageKeys.delete("answerReady");
    stageKeys.add("needsEvidence");
  }
  return AGENT_TRACE_STAGE_ORDER.filter((stageKey) => stageKeys.has(stageKey));
}

export function getCurrentAgentTraceStep(
  events: Array<AgentEvent | LiveActivityEvent>,
): AgentTraceStageKey | null {
  const stages = getAgentTraceStageKeys({ events, citationCount: 0 });
  return stages.at(-1) ?? null;
}

export function CurrentAgentTraceStepPanel({
  localization,
  events,
}: {
  localization: ChatLocalization;
  lang: string;
  events: Array<AgentEvent | LiveActivityEvent>;
}) {
  const currentStep = getCurrentAgentTraceStep(events);
  if (!currentStep) return null;
  return (
    <div className="mt-2 rounded-lg border border-km-accent/20 bg-km-accent/10 px-3 py-2 text-xs text-cal-ink">
      <span className="font-semibold">
        {localization.agentTrace.currentStep}
      </span>
      <span className="mx-1 text-cal-muted">·</span>
      <span>{localization.agentTrace.stages[currentStep]}</span>
    </div>
  );
}

function agentTraceStepsFromPayload(payload: unknown): AgentTraceStep[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const rawTrace = (payload as { agent_trace?: unknown }).agent_trace;
  if (!Array.isArray(rawTrace)) return [];
  return rawTrace.filter(isAgentTraceStep);
}

function isAgentTraceStep(value: unknown): value is AgentTraceStep {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<AgentTraceStep>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.event_type === "string" &&
    (candidate.status === "completed" ||
      candidate.status === "skipped" ||
      candidate.status === "waiting" ||
      candidate.status === "failed")
  );
}

function payloadHasBooleanFlag(payload: unknown, flag: string): boolean {
  if (Array.isArray(payload)) {
    return payload.some((item) => payloadHasBooleanFlag(item, flag));
  }
  if (!payload || typeof payload !== "object") return false;
  return Object.entries(payload).some(
    ([key, value]) => key === flag && value === true,
  );
}

export function AgentTraceSummary({
  localization,
  events,
  citationCount,
}: {
  localization: ChatLocalization;
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
}) {
  const stageKeys = getAgentTraceStageKeys({ events, citationCount });
  if (stageKeys.length === 0) return null;

  return (
    <div className="rounded-lg border border-km-accent/20 bg-km-accent/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
        {localization.agentTrace.title}
      </p>
      <ol
        className="mt-2 flex min-w-0 flex-wrap gap-2"
        aria-label={localization.agentTrace.title}
      >
        {stageKeys.map((stageKey, index) => (
          <li
            key={stageKey}
            className="inline-flex min-h-8 min-w-0 items-center gap-1 rounded-full border border-km-accent/20 bg-white px-2.5 py-1 text-xs font-medium text-cal-ink"
          >
            <span className="shrink-0 text-cal-muted">{index + 1}</span>
            <span className="min-w-0 truncate">
              {localization.agentTrace.stages[stageKey]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
