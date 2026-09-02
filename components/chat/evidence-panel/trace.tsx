import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AgentEvent,
  type AgentTraceStep,
  agentTraceOperationalSummarySchema,
  REASONING_SUMMARY_MAX_LENGTH,
  type ReasoningSummaryDisplay,
} from "@/model/my-agents";
import type { ChatLocalization, LiveActivityEvent } from "../types";
import { formatOperationalSummary } from "./operational-summary";
import { ReasoningSummarySection } from "./ReasoningSummarySection";
import { ShimmerText } from "./ShimmerText";

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

/**
 * The single row the collapsed panel shows.
 *
 * Exactly one element in the panel carries `data-current`/`data-terminal`, and
 * it is this one. Two would make the state assertions ambiguous, and a marker
 * on a row inside a closed `<details>` has no box for a geometric assertion to
 * measure.
 */
export type AgentProcessHeadline = {
  label: string;
  /** Drives the pulsing dot: the run is still working on this row. */
  isLive: boolean;
  current: boolean;
  terminal: AgentProcessTerminal | null;
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
        if (hasCompletedAnswerComposer && !hasInsufficientEvidence) {
          stageKeys.add("answerReady");
        } else if (hasInsufficientEvidence) {
          stageKeys.add("needsEvidence");
        }
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
  if (lifecycleEvent && /run_(failed|error)$/.test(lifecycleEvent)) {
    terminal = "failed";
  } else if (lifecycleEvent?.endsWith("run_cancelled")) {
    terminal = "cancelled";
  } else if (lifecycleEvent?.endsWith("run_interrupted")) {
    terminal = "waitingForConfirmation";
  } else if (hasInsufficientEvidence) {
    terminal = "needsEvidence";
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
  localization,
}: {
  events: Array<AgentEvent | LiveActivityEvent>;
  lang: string;
  /*
   * Optional so the existing two-argument call sites keep working. Without it
   * the backend's own `description` is used, which is exactly the pre-contract
   * behaviour and the right fallback for a run that predates operational
   * summaries.
   */
  localization?: ChatLocalization;
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
      /*
       * The verified operational summary wins over the backend's prose when
       * both exist.
       *
       * They describe the same stage, but only one of them is safe to show:
       * `description` is free-form backend text and is how an interpolated
       * reranker enum reached a primary reading path, while the summary is a
       * semantic key with closed parameters that this build words itself.
       * Parsed here rather than trusted, because `isAgentTraceStep` is a
       * structural guard that never inspected this field — an unknown key or a
       * future version yields no sentence and falls back.
       */
      const operational = localization
        ? formatOperationalSummary(
            agentTraceOperationalSummarySchema.safeParse(
              (step as { operational_summary?: unknown }).operational_summary,
            ).data,
            localization,
          )
        : null;
      const description =
        operational ||
        step.description[locale] ||
        step.description.en ||
        step.description.ko;
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
    return localization.answerProcess.terminals.waiting;
  }
  if (terminal === "failed") return localization.answerProcess.terminals.failed;
  if (terminal === "cancelled") {
    return localization.answerProcess.terminals.cancelled;
  }
  return null;
}

function terminalDotClass(terminal: AgentProcessTerminal | null) {
  if (terminal === "failed") return "bg-cal-error";
  if (terminal === "cancelled") return "bg-cal-muted";
  if (terminal === "waitingForConfirmation") return "bg-cal-warning";
  if (terminal === "needsEvidence") return "bg-cal-warning";
  return "bg-km-accent";
}

export function getAgentProcessHeadline({
  state,
  localization,
  isStarting,
}: {
  state: AgentProcessState;
  localization: ChatLocalization;
  isStarting: boolean;
}): AgentProcessHeadline | null {
  if (isStarting) {
    return {
      label: localization.answerProcess.starting,
      isLive: true,
      current: true,
      terminal: null,
    };
  }

  const terminalText = state.terminal
    ? terminalLabel(state.terminal, localization)
    : null;
  if (state.terminal && terminalText) {
    return {
      label: terminalText,
      isLive: false,
      current: false,
      terminal: state.terminal,
    };
  }
  // `needsEvidence` is a terminal with no terminal label: the backend reports
  // it as a stage the run reached, so the headline names the stage and keeps
  // the warning treatment rather than inventing a second vocabulary for it.
  if (state.terminal === "needsEvidence") {
    return {
      label: localization.answerProcess.stages.needsEvidence,
      isLive: false,
      current: false,
      terminal: "needsEvidence",
    };
  }
  if (state.currentStage) {
    return {
      label: localization.answerProcess.stages[state.currentStage],
      isLive: true,
      current: true,
      terminal: null,
    };
  }
  if (state.terminal === "completed") {
    return {
      label: localization.answerProcess.completedSummary.replace(
        "{count}",
        String(state.stages.length),
      ),
      isLive: false,
      current: false,
      terminal: null,
    };
  }
  // Stages without a lifecycle event: a cold load of a run whose terminal event
  // never arrived. Name the furthest stage reached rather than claiming a
  // completion the events do not support.
  const lastStage = state.stages.at(-1);
  if (!lastStage) return null;
  return {
    label: localization.answerProcess.stages[lastStage],
    isLive: false,
    current: false,
    terminal: null,
  };
}

/**
 * Sits at the top of the answer it describes, collapsed to the run's current
 * step. The full step list is one disclosure away.
 *
 * It is one `<details>` in every state, running included. The running state
 * used to be a permanently expanded block below the answer, which pushed the
 * answer down as it grew and read as retrospective once the run finished.
 */
export function AgentProcessPanel({
  localization,
  lang,
  events,
  citationCount,
  isStreaming,
  reasoningSummaries,
}: {
  localization: ChatLocalization;
  lang: string;
  events: Array<AgentEvent | LiveActivityEvent>;
  citationCount: number;
  isStreaming: boolean;
  reasoningSummaries: ReasoningSummaryDisplay[];
}) {
  const state = getAgentProcessState({ events, citationCount, isStreaming });
  const details = getAgentProcessDetails({ events, lang, localization });
  const terminalText = state.terminal
    ? terminalLabel(state.terminal, localization)
    : null;
  const isStarting =
    isStreaming &&
    events.length > 0 &&
    state.stages.length === 0 &&
    state.terminal === null;
  if (state.stages.length === 0 && !terminalText && !isStarting) return null;

  const headline = getAgentProcessHeadline({ state, localization, isStarting });
  if (!headline) return null;

  /*
   * The model's own account of the approach, raised to the collapsed row while
   * the run is still working.
   *
   * `retrieval_planning` is the only summary eligible for this. It is produced
   * by the tool-selection node *before* retrieval executes, so it exists during
   * the wait and is specific to the question that is being waited on.
   * `answer_synthesis` comes off the completed response and cannot help here —
   * by the time it exists there is nothing left to wait for.
   *
   * It never replaces the verified step label; it stacks beneath it. Swapping
   * the label would change that row's trust status mid-run, and the label is
   * also the only short, stable thing in the row.
   */
  const planningSummary = reasoningSummaries
    .find((item) => item.stage === "retrieval_planning")
    ?.text.slice(0, REASONING_SUMMARY_MAX_LENGTH);
  /*
   * One message at a time, newest wins.
   *
   * `details` is built in event-sequence order, so the last one carrying a
   * description is the most recent thing the run has said. The planning summary
   * is the opening message and holds the row until the first step description
   * arrives — which is the retrieval wait, the longest gap in a run.
   *
   * Derived, never stored. A queue with dwell timers would read more evenly,
   * but it would put a second, drifting copy of run progress in this component;
   * everything the row skips stays recoverable in the expanded list below.
   */
  const liveProcessMessage = isStreaming
    ? (details.filter((detail) => detail.description).at(-1)?.description ??
      planningSummary)
    : undefined;

  const processList = (
    <ol className="grid min-w-0 gap-2">
      {isStarting ? (
        <li className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-2 text-sm">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2.5 rounded-full bg-cal-primary motion-safe:animate-pulse"
          />
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 font-semibold">
            <span>{localization.answerProcess.starting}</span>
            <span className="text-xs font-normal text-cal-muted">
              {localization.answerProcess.currentStep}
            </span>
          </span>
        </li>
      ) : null}
      {state.stages.map((stage) => {
        const isCurrent = stage === state.currentStage;
        const isUnmetEvidence =
          stage === "needsEvidence" && state.terminal === "needsEvidence";
        const stageDetails = details.filter((detail) => detail.phase === stage);
        /*
         * Every step that said something says it here, not just the last one.
         *
         * Two backend steps routinely share a stage — `query_cartographer` and
         * `source_warden` are both planning — so rendering only the newest
         * silently dropped the other's sentence. That was tolerable when the
         * sentences were backend prose restating the stage title; it is not now
         * that each one is a distinct verified fact. It is also what keeps the
         * collapsed row's promise: that row shows one message at a time and is
         * allowed to skip precisely because this list is complete.
         */
        const describedDetails = stageDetails.filter(
          (detail) => detail.description,
        );
        /*
         * Every stage that has a description shows it.
         *
         * The previous gate was `isCurrent || (terminal && stage is last)`, and
         * its terminal half could never fire: nothing in `phaseForTraceStep`
         * maps to `answerReady`, which is the last stage of every successful
         * run, so `stageDetails` there is always empty. The effect was that no
         * backend-authored description rendered anywhere once a run finished.
         *
         * The expanded panel is also where the collapsed row's rotating
         * message is supposed to be recoverable, which only works if the full
         * set is here.
         */
        return (
          <li
            key={stage}
            className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-2 text-sm"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 size-2.5 rounded-full",
                isCurrent
                  ? "bg-cal-primary motion-safe:animate-pulse"
                  : isUnmetEvidence
                    ? "bg-cal-warning"
                    : "bg-km-accent",
              )}
            />
            <div className="min-w-0">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={isCurrent ? "font-semibold" : "font-medium"}>
                  {localization.answerProcess.stages[stage]}
                </span>
                {isCurrent ? (
                  <span className="text-xs text-cal-muted">
                    {localization.answerProcess.currentStep}
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
              {describedDetails.map((detail) => (
                <p
                  key={detail.key}
                  data-slot="process-step-summary"
                  className="mt-1.5 break-words text-xs leading-5 text-cal-muted"
                >
                  {detail.description}
                </p>
              ))}
            </div>
          </li>
        );
      })}
      {terminalText ? (
        <li className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] items-start gap-2 text-sm font-semibold">
          <span
            aria-hidden="true"
            className={`mt-1.5 size-2.5 rounded-full ${terminalDotClass(state.terminal)}`}
          />
          <span>{terminalText}</span>
        </li>
      ) : null}
    </ol>
  );

  const liveAnnouncement =
    headline.current && !isStarting
      ? `${localization.answerProcess.currentStep}: ${headline.label}`
      : headline.label;

  return (
    <div className="w-full min-w-0">
      <details
        data-testid="agent-process-panel"
        aria-label={localization.answerProcess.title}
        // The accent tint is kept when open. The step chips are `bg-km-surface`,
        // so swapping the open panel to that same token erased them in both
        // themes — they only read as chips against the tint.
        className="group/process w-full min-w-0 rounded-lg border border-km-accent/20 bg-km-accent/10 text-cal-ink"
      >
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 marker:hidden">
          <span
            data-current={headline.current ? "true" : undefined}
            data-terminal={headline.terminal ?? undefined}
            className="flex min-w-0 flex-1 items-center gap-2 text-sm"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                headline.isLive
                  ? "bg-cal-primary motion-safe:animate-pulse"
                  : terminalDotClass(headline.terminal),
              )}
            />
            {/*
              Keyed on the label so React remounts the node when the run moves
              to another step, which replays the enter animation. Without the
              key the text swaps in place with no transition.
            */}
            <span
              key={headline.label}
              className="min-w-0 truncate font-semibold motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-[var(--duration-panel)]"
            >
              {headline.label}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-cal-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-open/process:rotate-180"
          />
          {/*
            `basis-full` gives this its own line below the label rather than
            competing with it for the truncated one.

            `aria-hidden` because this sits inside `<summary>`, whose text
            content *is* the disclosure control's accessible name: leaving it
            exposed would rename the toggle to a paragraph that changes as the
            run progresses. The same text is announced by the live region below
            and reachable, properly framed, one control away.
          */}
          {liveProcessMessage ? (
            <p
              aria-hidden="true"
              data-slot="live-reasoning-summary"
              /*
                The sweep is expressed as `motion-safe:` utilities, not a
                component class. A `@layer components` rule loses to the
                `text-cal-muted` utility that has to stay for the resting
                colour, and the compiler dropped the unlayered half of it
                outright. As utilities all of this sits in one layer, and
                `motion-safe:` gives the reduced-motion fallback for free —
                under `reduce` none of it applies and the row is plain muted
                text.

                Wrapping the text in an inner span to dodge the cascade was
                tried and reverted: an `inline-block` child counts as a single
                line box, so `line-clamp-2` silently stopped clamping.

                The gradient runs muted → ink → muted, so the pass *raises*
                contrast rather than fading the text out. At every frame the
                row stays at least as readable as at rest, in both themes —
                which a fade-to-background shimmer cannot promise on 12px
                Korean.
              */
              className="line-clamp-2 basis-full border-s border-cal-hairline ps-3 text-xs leading-5 text-cal-muted"
            >
              <ShimmerText text={liveProcessMessage} wave />
            </p>
          ) : null}
        </summary>
        <div className="max-h-[min(32rem,70dvh)] overflow-y-auto border-t border-km-accent/20 p-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-[var(--duration-panel)]">
          {processList}
          <ReasoningSummarySection
            summaries={reasoningSummaries}
            isStreaming={isStreaming}
            localization={localization}
          />
        </div>
      </details>
      {/*
        Outside the `<details>`: a closed disclosure is hidden from the
        accessibility tree, so a live region inside it would never announce a
        step change to a reader who left the panel collapsed.
      */}
      <span
        aria-live="polite"
        data-slot="agent-process-announcement"
        className="sr-only"
      >
        {liveAnnouncement}
      </span>
      {/*
        Carries the planning summary only, not the rotating row above it.

        The row swaps roughly in step with the run, and every later message is a
        longer form of the step label the region above already announces —
        mirroring it here would read each advance twice. The planning summary is
        the one message with no spoken equivalent, and it changes once per run,
        so it is announced once. The messages this skips stay in the expanded
        list.
      */}
      <span
        aria-live="polite"
        data-slot="live-reasoning-summary-announcement"
        className="sr-only"
      >
        {isStreaming ? (planningSummary ?? "") : ""}
      </span>
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
