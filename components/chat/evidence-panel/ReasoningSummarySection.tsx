"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  REASONING_SUMMARY_MAX_LENGTH,
  type ReasoningSummaryDisplay,
  type ReasoningSummaryStage,
} from "@/model/my-agents";
import type { ChatLocalization } from "../types";

const STAGE_ORDER: ReasoningSummaryStage[] = [
  "retrieval_planning",
  "answer_synthesis",
];

/**
 * What the model says it did, below what the application verified it did.
 *
 * Deliberately unheaded. The enclosing `답변 과정` disclosure already tells the
 * reader they opted into process detail, and the pattern — an answer with an
 * expandable account of how it was produced — is familiar enough from other
 * assistants that naming it again reads as instruction rather than help. The
 * separation is carried by form instead: a rule, an inset quote, muted type,
 * and the absence of the step dots and status colours that mean *verified*.
 *
 * That leaves nothing for a screen reader, which cannot see the rule or the
 * indent, so the region carries a visually hidden name. It is the assistive
 * equivalent of the divider, not a reinstated heading.
 */
export function ReasoningSummarySection({
  summaries,
  isStreaming,
  localization,
}: {
  summaries: ReasoningSummaryDisplay[];
  isStreaming: boolean;
  localization: ChatLocalization;
}) {
  const labelId = useId();
  if (summaries.length === 0) return null;

  // Fixed by stage, never by arrival: the two stages describe a sequence, and
  // ordering them by whichever settled first would make it read as a race.
  const ordered = STAGE_ORDER.flatMap((stage) => {
    const summary = summaries.find((item) => item.stage === stage);
    return summary ? [summary] : [];
  });
  if (ordered.length === 0) return null;

  return (
    <section
      data-slot="reasoning-summary"
      aria-labelledby={labelId}
      aria-busy={isStreaming || undefined}
      className="mt-3 border-t border-km-accent/20 pt-3"
    >
      <h4 id={labelId} className="sr-only">
        {localization.reasoningSummary.label}
      </h4>
      <div className="grid divide-y divide-cal-hairline">
        {ordered.map((summary) => (
          <ReasoningSummaryItem
            key={summary.stage}
            summary={summary}
            localization={localization}
          />
        ))}
      </div>
    </section>
  );
}

function ReasoningSummaryItem({
  summary,
  localization,
}: {
  summary: ReasoningSummaryDisplay;
  localization: ChatLocalization;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const quoteRef = useRef<HTMLQuoteElement>(null);
  // Bounded at render rather than at parse. The served contract caps this at
  // 500 characters, but enforcing that cap while parsing would let one
  // over-long summary fail the completed-run response and take the answer with
  // it. See `reasoningSummarySchema`.
  const text = summary.text.slice(0, REASONING_SUMMARY_MAX_LENGTH);

  /*
   * Measured, not guessed from length.
   *
   * A character threshold cannot serve both languages: three lines is roughly
   * 165 characters of English but only about 70 of Korean at 390px, so any
   * single number either hides the control on clamped Korean — the primary
   * language — or offers a dead one on short English. Asking the element
   * whether it actually overflows is correct at every width and in both.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `text` is not read in the body, but it is the trigger. A streaming summary that grows past three lines keeps the same clamped border box, so the observer below never fires for it; without this dependency the control would never appear on a summary that arrived by delta.
  useEffect(() => {
    const node = quoteRef.current;
    if (!node) return;
    const measure = () =>
      setIsClamped(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);

  const canExpand = isClamped || isExpanded;

  return (
    <div className="min-w-0 py-2 first:pt-0 last:pb-0">
      <blockquote
        ref={quoteRef}
        className={cn(
          "break-words border-s border-cal-hairline ps-3 text-sm leading-6 text-cal-muted",
          !isExpanded && "line-clamp-3",
        )}
      >
        {text}
      </blockquote>
      {canExpand ? (
        <button
          type="button"
          className="ms-3 mt-1 min-h-11 text-xs font-semibold text-km-accent underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-km-accent"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded
            ? localization.reasoningSummary.collapse
            : localization.reasoningSummary.expand}
        </button>
      ) : null}
    </div>
  );
}
