import type { AgentTraceOperationalSummary } from "@/model/my-agents";
import type { ChatLocalization } from "../types";

/**
 * Turns a verified operational summary into the sentence the panel shows.
 *
 * The backend sends a semantic key and closed scalar parameters; the wording is
 * ours. That split is the whole point of the contract — free-form backend prose
 * is how an interpolated reranker enum reached a primary reading path — so this
 * module must never echo a raw parameter value. Enum parameters resolve through
 * the label maps below; anything unmapped yields no sentence rather than a bare
 * identifier.
 *
 * Returns `null` for anything it cannot state, and callers fall back to the
 * backend's own `description`.
 */
export function formatOperationalSummary(
  summary: AgentTraceOperationalSummary | null | undefined,
  localization: ChatLocalization,
): string | null {
  if (!summary) return null;
  const copy = localization.answerProcess.operational;

  switch (summary.message_key) {
    case "agent_trace.query_planned": {
      const method = copy.routes[summary.parameters.retrieval_route];
      const scope = copy.scopes[summary.parameters.document_scope];
      // A value the served enum gained after this build shipped: say nothing
      // rather than print the identifier.
      if (!method || !scope) return null;
      // `{method}`, not `{route}`: the placeholder name reaches the localized
      // string, and `route` is banned implementation vocabulary there.
      return fill(copy.queryPlanned, { method, scope });
    }
    case "agent_trace.sources_resolved":
      return fill(copy.sourcesResolved, {
        count: summary.parameters.resolved_knowledge_base_count,
      });
    case "agent_trace.candidates_found":
      return fill(copy.candidatesFound, {
        count: summary.parameters.candidate_count,
        authorized: summary.parameters.authorized_context_count,
      });
    case "agent_trace.relevance_ordered":
      // Deliberately no reranker name. Which implementation ordered the
      // candidates stays in structured evidence, not in display text.
      return fill(copy.relevanceOrdered, {
        count: summary.parameters.candidate_count,
      });
    case "agent_trace.context_prepared":
      return fill(
        summary.parameters.budget_truncated
          ? copy.contextPreparedTruncated
          : copy.contextPrepared,
        {
          injected: summary.parameters.injected_count,
          rejected: summary.parameters.rejected_count,
        },
      );
    case "agent_trace.graph_invoked":
      return fill(copy.graphInvoked, {
        count: summary.parameters.retrieved_chunk_count,
      });
    case "agent_trace.answer_prepared":
      return fill(copy.answerPrepared, {
        count: summary.parameters.citation_count,
      });
    case "agent_trace.clarification_requested":
      return copy.clarificationRequested;
    default:
      return null;
  }
}

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    key in values ? String(values[key]) : token,
  );
}
