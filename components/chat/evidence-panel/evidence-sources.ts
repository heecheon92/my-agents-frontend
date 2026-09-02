import type { Citation } from "@/model/my-agents";

/**
 * One source row, and whether the answer verifiably drew on it.
 *
 * `isSupported` is a *claim about verification*, not about relevance. A source
 * with `false` was still read by the model; it just did not produce a passage
 * matching the answer.
 */
export type EvidenceSource = {
  citation: Citation;
  isSupported: boolean;
};

/**
 * `legacy` means the run predates citation attribution and nothing here was
 * checked — the UI must not badge anything in that mode, because every row
 * would be claiming a verification that never happened. `attributed` means the
 * backend ran attribution, so `isSupported` is meaningful and `[]` is a real
 * answer rather than missing data.
 */
export type EvidenceSourceMode = "legacy" | "attributed";

export type EvidenceSourceList = {
  mode: EvidenceSourceMode;
  items: EvidenceSource[];
};

/**
 * Merge the answer-supported subset into the full consulted list.
 *
 * The backend contract (preserved in `docs/backend-requests-archive.md`,
 * 2026-08-25) is that
 * `consulted_sources` is a **superset** of `citations`, and a source present in
 * both is the identical persisted row carrying the identical `id`. So the join
 * is by `id` and nothing else — deriving it from `chunk_id`, title or snippet
 * would silently double-render a source the moment any of those collide.
 *
 * `null`/`undefined` is not the same as `[]`, and the distinction is the whole
 * reason the field is nullable. A run from before attribution shipped reports
 * `null`, and its `citations` are the old unverified flat list; marking those
 * as answer-supported would put a stronger claim on old answers than on new
 * ones, which is exactly the overclaiming this feature exists to remove. `[]`
 * means attribution ran and found nothing consulted.
 */
export function buildEvidenceSources({
  citations,
  consultedSources,
}: {
  citations: Citation[];
  consultedSources?: Citation[] | null;
}): EvidenceSourceList {
  if (consultedSources == null) {
    return {
      mode: "legacy",
      items: citations.map((citation) => ({ citation, isSupported: false })),
    };
  }

  const supportedIds = new Set(citations.map((citation) => citation.id));
  const items: EvidenceSource[] = consultedSources.map((citation) => ({
    citation,
    isSupported: supportedIds.has(citation.id),
  }));

  // Defensive, and deliberately not trusting the superset guarantee. If a cited
  // source is missing from the consulted list the contract has been violated
  // somewhere, but dropping it would hide the *strongest* evidence the answer
  // has. Appending keeps it visible; the ordering stays consulted-first so the
  // normal case is unaffected.
  const consultedIds = new Set(consultedSources.map((citation) => citation.id));
  for (const citation of citations) {
    if (consultedIds.has(citation.id)) continue;
    items.push({ citation, isSupported: true });
  }

  return { mode: "attributed", items };
}

/** How many rows carry a verified match. Zero is an expected, common result. */
export function countSupported(items: EvidenceSource[]) {
  return items.filter((item) => item.isSupported).length;
}

/**
 * One document, however many chunks it contributed.
 *
 * The panel is a list of documents, not of retrieved passages. A single
 * document routinely produces several chunks, and rendering one row each made
 * the same filename repeat four times with near-identical snippets — which
 * reads as four sources rather than one.
 */
export type EvidenceDocument = {
  documentId: string;
  /** `null` when the backend has neither a filename nor a title for it. */
  displayName: string | null;
  knowledgeBaseName: string | null;
  /** Unique, ascending. Empty for a source with no page information. */
  pages: number[];
  /** True when *any* chunk from this document supported the answer. */
  isSupported: boolean;
};

/**
 * Collapse chunk-level sources into one row per document.
 *
 * `document_id` is the grouping key and stays internal — it is never rendered.
 * Chunk ids, knowledge-base ids and snippets are dropped here rather than
 * hidden in the markup, so there is no path by which they reach the DOM.
 * Chunk-level provenance is unchanged server-side; this is a presentation
 * boundary, not a loss of audit data.
 *
 * Insertion order is preserved: the backend returns sources in its own
 * relevance order, and re-sorting here would invent a ranking the frontend has
 * no basis for.
 */
export function groupSourcesByDocument(
  items: EvidenceSource[],
): EvidenceDocument[] {
  const byDocument = new Map<string, EvidenceDocument>();
  const pagesSeen = new Map<string, Set<number>>();

  for (const { citation, isSupported } of items) {
    const key = citation.document_id;
    let row = byDocument.get(key);
    if (!row) {
      row = {
        documentId: key,
        // Filename first: it is what the user recognises, and two documents
        // can legitimately share a title.
        displayName:
          citation.source_filename ?? citation.document_title ?? null,
        knowledgeBaseName: citation.knowledge_base_name ?? null,
        pages: [],
        isSupported: false,
      };
      byDocument.set(key, row);
      pagesSeen.set(key, new Set());
    }
    // Any supporting chunk makes the whole document supported.
    if (isSupported) row.isSupported = true;
    // A later chunk can carry a name an earlier one lacked.
    row.displayName ??=
      citation.source_filename ?? citation.document_title ?? null;
    row.knowledgeBaseName ??= citation.knowledge_base_name ?? null;
    if (typeof citation.source_page === "number") {
      pagesSeen.get(key)?.add(citation.source_page);
    }
  }

  for (const [key, pages] of pagesSeen) {
    const row = byDocument.get(key);
    if (row) row.pages = [...pages].sort((a, b) => a - b);
  }

  return [...byDocument.values()];
}
