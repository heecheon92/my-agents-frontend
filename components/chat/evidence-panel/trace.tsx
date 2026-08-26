import type { AgentEvent, AgentTraceStep } from "@/model/my-agents";
import type { ChatLocalization, LiveActivityEvent } from "../types";

export type AgentTraceStageKey =
  | "planning"
  | "searchingKnowledge"
  | "draftingAnswer"
  | "checkingCitations"
  | "answerReady"
  | "needsEvidence";

export type AgentProcessTerminal =
  | "completed"
  | "failed"
  | "cancelled"
  | "waitingForConfirmation"
  | "needsEvidence";

export type AgentProcessState = {
  stages: AgentTraceStageKey[];
  currentStage: AgentTraceStageKey | null;
  terminal: AgentProcessTerminal | null;
};

export type AgentProcessDetail = {
  key: string;
  phase: AgentTraceStageKey;
  title: string;
  description: string;
  status: AgentTraceStep["status"];
};

const AGENT_TRACE_STAGE_ORDER: AgentTraceStageKey[] = [
  "planning",
  "searchingKnowledge",
  "draftingAnswer",
  "checkingCitations",
  "answerReady",
  "needsEvidence",
];

const BACKEND_TRACE_STAGE_MAP: Partial<Record<string, AgentTraceStageKey>> = {
  query_cartographer: "planning",
  source_warden: "planning",
  candidate_scouts: "searchingKnowledge",
  context_curator: "searchingKnowledge",
  evidence_judge: "checkingCitations",
  assistant_graph: "draftingAnswer",
};

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
  for (const event of events) {
    for (const step of agentTraceStepsFromPayload(event.payload)) {
      if (step.status === "skipped") continue;
      if (step.id === "answer_composer") {
        hasCompletedAnswerComposer = step.status === "completed";
        stageKeys.add("draftingAnswer");
        stageKeys.add(
          hasCompletedAnswerComposer && !hasInsufficientEvidence
            ? "answerReady"
            : "needsEvidence",
        );
        continue;
      }
      stageKeys.add(phaseForTraceStep(step, event.event_type.toLowerCase()));
    }
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

export function getAgentProcessState({
  events,
  citationCount,
  isStreaming,
}: {
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
  isStreaming: boolean;
}): AgentProcessState {
  if (events.length === 0) {
    return { stages: [], currentStage: null, terminal: null };
  }

  const hasInsufficientEvidence = events.some((event) =>
    payloadHasBooleanFlag(event.payload, "insufficient_evidence"),
  );
  let stages = getAgentTraceStageKeys({ events, citationCount });
  const hasObservedWork = events.some(
    (event) =>
      event.event_type !== "run_started" &&
      event.event_type !== "user_message_stored",
  );
  if (!hasObservedWork) stages = [];
  const lifecycleEvent = [...events]
    .sort((left, right) => left.sequence - right.sequence)
    .filter((event) =>
      /(^|_)run_(interrupted|resumed|failed|error|cancelled|completed)$/.test(
        event.event_type.toLowerCase(),
      ),
    )
    .at(-1)?.event_type;

  let terminal: AgentProcessTerminal | null = null;
  if (hasInsufficientEvidence) {
    terminal = "needsEvidence";
  } else if (lifecycleEvent && /run_(failed|error)$/.test(lifecycleEvent)) {
    terminal = "failed";
  } else if (lifecycleEvent?.endsWith("run_cancelled")) {
    terminal = "cancelled";
  } else if (lifecycleEvent?.endsWith("run_interrupted")) {
    terminal = "waitingForConfirmation";
  } else if (lifecycleEvent?.endsWith("run_completed")) {
    terminal = "completed";
  }
  // The legacy stage derivation treated any unready terminal as `needsEvidence`.
  // Failure and cancellation are different claims, so keep that stage only
  // when the backend actually reports insufficient evidence.
  if (!hasInsufficientEvidence && terminal && terminal !== "completed") {
    stages = stages.filter((stage) => stage !== "needsEvidence");
  }
  if (terminal === "waitingForConfirmation" && isStreaming) {
    terminal = null;
  }

  return {
    stages,
    currentStage:
      isStreaming && terminal === null ? (stages.at(-1) ?? null) : null,
    terminal,
  };
}

function phaseForTraceStep(
  step: AgentTraceStep,
  containerEventType: string,
): AgentTraceStageKey {
  if (step.id === "answer_composer") return "draftingAnswer";
  const mapped = BACKEND_TRACE_STAGE_MAP[step.id];
  if (mapped) return mapped;

  const searchText = `${step.id} ${step.event_type}`.toLowerCase();
  if (/citation|evidence|verify|check/.test(searchText)) {
    return "checkingCitations";
  }
  if (/answer|assistant|draft|compose/.test(searchText)) {
    return "draftingAnswer";
  }
  if (/search|retriev|candidate|context|source/.test(searchText)) {
    return "searchingKnowledge";
  }
  if (/query|plan|route|scope/.test(searchText)) return "planning";

  if (/retrieval/.test(containerEventType)) return "searchingKnowledge";
  if (/answer/.test(containerEventType)) return "draftingAnswer";
  if (/graph/.test(containerEventType)) return "planning";
  return "planning";
}

export function getAgentProcessDetails({
  events,
  lang,
}: {
  events: Array<AgentEvent | LiveActivityEvent>;
  lang: string;
}): AgentProcessDetail[] {
  const locale = lang.toLowerCase().startsWith("ko") ? "ko" : "en";
  const details = new Map<string, AgentProcessDetail>();

  for (const event of [...events].sort(
    (left, right) => left.sequence - right.sequence,
  )) {
    for (const step of agentTraceStepsFromPayload(event.payload)) {
      if (step.status === "skipped") continue;
      const key = `${step.id}:${step.event_type}`;
      const title = step.title[locale] || step.title.en || step.title.ko;
      const description =
        step.description[locale] || step.description.en || step.description.ko;
      details.set(key, {
        key,
        phase: phaseForTraceStep(step, event.event_type.toLowerCase()),
        title,
        description,
        status: step.status,
      });
    }
  }

  return [...details.values()];
}

function terminalLabel(
  terminal: AgentProcessTerminal,
  localization: ChatLocalization,
) {
  if (terminal === "waitingForConfirmation") {
    return localization.agentTrace.terminals.waiting;
  }
  if (terminal === "failed") return localization.agentTrace.terminals.failed;
  if (terminal === "cancelled") {
    return localization.agentTrace.terminals.cancelled;
  }
  return null;
}

function terminalDotClass(terminal: AgentProcessTerminal | null) {
  if (terminal === "failed") return "bg-cal-error";
  if (terminal === "cancelled") return "bg-cal-muted";
  if (terminal === "waitingForConfirmation") return "bg-cal-warning";
  return "bg-km-accent";
}

export function AgentProcessPanel({
  localization,
  lang,
  events,
  citationCount,
  isStreaming,
}: {
  localization: ChatLocalization;
  lang: string;
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
  isStreaming: boolean;
}) {
  const state = getAgentProcessState({ events, citationCount, isStreaming });
  const details = getAgentProcessDetails({ events, lang });
  const terminalText = state.terminal
    ? terminalLabel(state.terminal, localization)
    : null;
  const isStarting =
    isStreaming &&
    events.length > 0 &&
    state.stages.length === 0 &&
    state.terminal === null;
  if (state.stages.length === 0 && !terminalText && !isStarting) return null;

  const processList = (
    <ol className="grid min-w-0 gap-2">
      {isStarting ? (
        <li className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-2 text-sm">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2.5 rounded-full bg-cal-primary motion-safe:animate-pulse"
          />
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 font-semibold">
            <span>{localization.agentTrace.starting}</span>
            <span className="text-xs font-normal text-cal-muted">
              {localization.agentTrace.currentStep}
            </span>
          </span>
        </li>
      ) : null}
      {state.stages.map((stage) => {
        const isCurrent = stage === state.currentStage;
        const stageDetails = details.filter((detail) => detail.phase === stage);
        const latestDetail = stageDetails.at(-1);
        const showLatestDescription =
          latestDetail?.description &&
          (isCurrent ||
            (state.terminal !== null && stage === state.stages.at(-1)));
        return (
          <li
            key={stage}
            data-current={isCurrent ? "true" : "false"}
            data-terminal={
              stage === "needsEvidence" && state.terminal === "needsEvidence"
                ? "needsEvidence"
                : undefined
            }
            className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-2 text-sm"
          >
            <span
              aria-hidden="true"
              className={
                isCurrent
                  ? "mt-1.5 size-2.5 rounded-full bg-cal-primary motion-safe:animate-pulse"
                  : stage === "needsEvidence" &&
                      state.terminal === "needsEvidence"
                    ? "mt-1.5 size-2.5 rounded-full bg-cal-warning"
                    : "mt-1.5 size-2.5 rounded-full bg-km-accent"
              }
            />
            <div className="min-w-0">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={isCurrent ? "font-semibold" : "font-medium"}>
                  {localization.agentTrace.stages[stage]}
                </span>
                {isCurrent ? (
                  <span className="text-xs text-cal-muted">
                    {localization.agentTrace.currentStep}
                  </span>
                ) : null}
              </span>
              {stageDetails.length > 0 ? (
                <ul
                  aria-live="off"
                  className="mt-1.5 flex min-w-0 flex-wrap gap-1.5"
                >
                  {stageDetails.map((detail, detailIndex) => (
                    <li
                      key={detail.key}
                      className="min-w-0 rounded-md bg-km-surface px-2 py-1 text-xs font-medium text-cal-ink motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1"
                      style={{ animationDelay: `${detailIndex * 70}ms` }}
                    >
                      <span className="break-words">{detail.title}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {showLatestDescription ? (
                <p className="mt-1.5 break-words text-xs leading-5 text-cal-muted">
                  {latestDetail.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
      {terminalText ? (
        <li
          data-terminal={state.terminal}
          className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-2 text-sm font-semibold"
        >
          <span
            aria-hidden="true"
            className={`mt-1.5 size-2.5 rounded-full ${terminalDotClass(state.terminal)}`}
          />
          <span>{terminalText}</span>
        </li>
      ) : null}
    </ol>
  );
  const liveAnnouncement = isStarting
    ? localization.agentTrace.starting
    : state.currentStage
      ? `${localization.agentTrace.currentStep}: ${localization.agentTrace.stages[state.currentStage]}`
      : terminalText;

  if (state.terminal === "completed") {
    return (
      <details
        data-testid="agent-process-panel"
        className="group/process w-fit max-w-full min-w-0 rounded-lg border border-km-accent/20 bg-km-accent/10 text-cal-ink open:bg-km-surface"
      >
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 text-xs marker:hidden">
          <span className="font-semibold uppercase tracking-[0.08em] text-cal-muted">
            {localization.agentTrace.title}
          </span>
          <span className="text-cal-muted">
            {localization.agentTrace.completedSummary.replace(
              "{count}",
              String(state.stages.length),
            )}
          </span>
        </summary>
        <div className="border-t border-km-accent/20 p-3">{processList}</div>
      </details>
    );
  }

  return (
    <section
      data-testid="agent-process-panel"
      className="w-full min-w-0 rounded-lg border border-km-accent/20 bg-km-accent/10 p-3 text-cal-ink"
      aria-label={localization.agentTrace.title}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
        {localization.agentTrace.title}
      </p>
      <div className="mt-2">{processList}</div>
      <span aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </span>
    </section>
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
    isAgentTraceText(candidate.title) &&
    isAgentTraceText(candidate.description) &&
    (candidate.status === "completed" ||
      candidate.status === "skipped" ||
      candidate.status === "waiting" ||
      candidate.status === "failed")
  );
}

function isAgentTraceText(value: unknown): value is AgentTraceStep["title"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as { en?: unknown; ko?: unknown };
  return typeof candidate.en === "string" && typeof candidate.ko === "string";
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
