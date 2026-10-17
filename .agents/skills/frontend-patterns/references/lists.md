# Server lists

## When to use

Use this for a server-owned collection when the product has deliberately chosen
numbered pages. The shell, controls, and pagination stay mounted while TanStack
Query owns only the result region and inherits the provider's query defaults.
The DTO and page contract are **illustrative choices**, not project defaults.
The caller owns what `criteria` means and how the service translates it.

The example uses TanStack Query v5 and project UI primitives. Verify installed
versions, provider defaults, aliases, and component APIs. The URL guidance below
assumes a Next.js App Router version with async page `searchParams`; use the
installed version's route contract rather than imposing that API on other stacks.

## Do not use

- Do not infer substring, prefix, fuzzy, case, token, debounce, or submit behavior
  from this example.
- Do not turn a client-side slice of a larger result into server pagination.
- Do not replace retained rows with a cold-loading state during refetch.
- Do not report an initial request failure as an empty collection.
- Do not reset the page for unrelated UI state; reset it only when an agreed
  query criterion actually changes.

## Required product decisions

Decide the service DTO, stable row identity, supported criteria, commit timing,
page size/numbering, sort order, maximum-page behavior, and empty/error copy.
Choose a query-key namespace containing every required tenant, account, or
resource identity; `"directory"` below is illustrative only. Decide whether
state must survive navigation, refresh, sharing, or browser history.

For URL-backed state, a Next App Router page should parse and validate its async
`searchParams`, choose canonical defaults, and pass controlled state here. Its
callback creates a new `URLSearchParams` and uses the approved `router.push` or
`router.replace` behavior. Keep parsing in that route adapter: `useSearchParams`
is read-only and can require a Suspense boundary on prerendered routes. For
ephemeral state, a parent may use `useState`; this reference prescribes neither.

## Stable guarantees

- `ServerDirectoryList` accepts controlled query state, change callback, service,
  and all user-facing copy.
- Its key contains every server-visible value and uses provider query defaults.
- The shell stays mounted through cold loading, retry, refresh, and failure.
- Cold pending, cold failure, empty success, retained refresh, and retained
  refresh failure remain distinct.
- A changed criterion requests page `1`; an unchanged value preserves the page.

## Complete example

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export type DirectoryEntry = {
  id: string;
  primaryText: string;
  secondaryText: string;
};
export type DirectoryQuery = { page: number; criteria: string };
export type DirectoryPage = {
  items: DirectoryEntry[];
  page: number;
  totalPages: number;
};
export type DirectoryService = {
  list(query: DirectoryQuery, signal: AbortSignal): Promise<DirectoryPage>;
};
export type DirectoryListCopy = {
  title: string;
  criteriaLabel: string;
  applyCriteria: string;
  empty: string;
  readFailed: string;
  refreshFailed: string;
  retry: string;
  loading: string;
  refreshing: string;
  navigationLabel: string;
  previousPage: string;
  nextPage: string;
  pageStatus(page: number, totalPages: number): string;
};
export type ServerDirectoryListProps = {
  query: DirectoryQuery;
  onQueryChange(query: DirectoryQuery): void;
  service: DirectoryService;
  copy: DirectoryListCopy;
};

export function ServerDirectoryList(
  { query, onQueryChange, service, copy }: ServerDirectoryListProps,
) {
  const criteriaId = useId();
  const [draftCriteria, setDraftCriteria] = useState(query.criteria);
  const result = useQuery({
    queryKey: ["directory", "page", query.page, query.criteria] as const,
    queryFn: ({ signal }) => service.list(query, signal),
  });
  const page = result.data;
  const hasData = page !== undefined;

  useEffect(() => {
    setDraftCriteria(query.criteria);
  }, [query.criteria]);

  function applyCriteria(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftCriteria === query.criteria) return;
    onQueryChange({ criteria: draftCriteria, page: 1 });
  }

  return (
    <section aria-labelledby={`${criteriaId}-title`} className="space-y-4">
      <header className="space-y-3">
        <h1 id={`${criteriaId}-title`} className="text-xl font-semibold">
          {copy.title}
        </h1>
        <form className="flex items-end gap-2" onSubmit={applyCriteria}>
          <label className="grid flex-1 gap-1" htmlFor={criteriaId}>
            <span className="text-sm font-medium">{copy.criteriaLabel}</span>
            <Input
              id={criteriaId}
              value={draftCriteria}
              onChange={(event) => setDraftCriteria(event.currentTarget.value)}
            />
          </label>
          <Button type="submit">{copy.applyCriteria}</Button>
        </form>
      </header>

      <div aria-busy={page === undefined && result.isPending} className="min-h-40">
        {page === undefined ? (
          result.isPending ? (
            <div aria-label={copy.loading} className="space-y-2">
              {["first", "second", "third"].map((slot) => (
                <div className="space-y-2 rounded-md border p-3" key={slot}>
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border p-4" role="alert">
              <p>{copy.readFailed}</p>
              <Button className="mt-3" onClick={() => void result.refetch()}>
                {copy.retry}
              </Button>
            </div>
          )
        ) : page.items.length === 0 ? (
          <p className="rounded-md border p-4">{copy.empty}</p>
        ) : (
          <ul className="space-y-2">
            {page.items.map((entry) => (
              <li className="rounded-md border p-3" key={entry.id}>
                <p className="font-medium">{entry.primaryText}</p>
                <p className="text-sm text-muted-foreground">
                  {entry.secondaryText}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasData && result.isFetching ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {copy.refreshing}
        </p>
      ) : null}
      {hasData && result.isError && !result.isFetching ? (
        <div className="flex items-center gap-2" role="alert">
          <p className="text-sm">{copy.refreshFailed}</p>
          <Button
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
            size="sm"
            variant="outline"
          >
            {copy.retry}
          </Button>
        </div>
      ) : null}

      <nav aria-label={copy.navigationLabel}>
        <div className="flex items-center justify-between gap-3">
          <Button
            disabled={page === undefined || query.page <= 1}
            onClick={() => onQueryChange({ ...query, page: query.page - 1 })}
            variant="outline"
          >
            {copy.previousPage}
          </Button>
          {page === undefined ? (
            <Skeleton aria-label={copy.loading} className="h-4 w-20" />
          ) : (
            <span aria-live="polite" className="text-sm">
              {copy.pageStatus(page.page, page.totalPages)}
            </span>
          )}
          <Button
            disabled={page === undefined || query.page >= page.totalPages}
            onClick={() => onQueryChange({ ...query, page: query.page + 1 })}
            variant="outline"
          >
            {copy.nextPage}
          </Button>
        </div>
      </nav>
    </section>
  );
}
```

The example-only service contract requires `page >= 1`, `totalPages >= 1`, and a
response matching the requested page. A production adapter must validate or
normalize its real backend contract rather than silently relying on those rules.

## Alternatives

Use offset pagination when the backend exposes a stable offset/limit contract;
include both values and every criterion in the query key. Use cursor pagination
when the backend owns opaque continuation tokens; model next/previous behavior
from its actual guarantees rather than fabricating page numbers. Use infinite
queries only when the approved interaction accumulates pages. Omit the criteria
form entirely when the API has no agreed query capability.

## Verification

Smoke with a controllable service: cold pending keeps the shell and shows three
row Skeletons; cold rejection offers Retry; empty success differs from failure;
retained rows survive refresh and refresh failure; page buttons emit controlled
state; only changed criteria emits page `1`. For a URL adapter, verify refresh,
Back/Forward, duplicate parameters, invalid pages, and push-versus-replace.
