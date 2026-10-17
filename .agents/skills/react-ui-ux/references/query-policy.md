# Client Query Policy

Use this reference when changing TanStack Query defaults, freshness, retention, invalidation, cached data, paused requests, or authenticated cache boundaries.

Treat freshness and inactive-cache retention as separate decisions. Projects may tune durations, but must preserve this three-policy distinction.

The examples use TanStack Query v5-style options and lifecycle APIs. Confirm compatibility with the installed version and existing QueryClient provider. Durations, keys, and services below are illustrative; choose them from the target project's actual freshness and retention requirements.

## Policy Vocabulary

```tsx
const queryDefaults = { staleTime: 60_000, gcTime: 5 * 60_000 } as const

const queryPolicy = {
  defaultRetained: queryDefaults,
  freshRetained: {
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  },
  noCacheAuthoritative: {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  },
} as const
```

1. **default-retained** — normal lists, catalogs, settings, and keyed results. Let the provider own defaults; ordinary call sites omit overrides. Mutation invalidation is the normal freshness mechanism.
2. **fresh-retained** — operational results and edit-opening reads that must refresh on mount, focus, and reconnect while prior data may paint context.
3. **no-cache-authoritative** — exceptional sensitive data whose inactive cache must be removed and whose current completed request gates actions. Every use needs a written retention-prohibition reason.

Never choose zero retention to hide missing invalidation. Every non-default policy must be justified.

## Client Memory Is Not Server or HTTP Caching

TanStack Query governs only browser memory. It does not replace request-level server freshness or HTTP cache controls.

```tsx
useQuery({ queryKey: ["records"], queryFn: getRecords, ...queryPolicy.freshRetained })
await fetch(serviceUrl, { cache: "no-store" }) // independent server/BFF decision
```

Authorization, permission, dependency, and complete-replacement preservation reads remain direct fresh service or server reads. Never authorize a mutation from QueryClient cache inspection.

## Retained Route-Switch Example

A previously visited list route paints retained rows immediately and starts its configured refresh. On a cold key, the route shell still paints and only the list body uses size-matched Skeletons or a regional Retry error. With retained data, keep shell, rows, selection, scroll, and drafts mounted; background errors never masquerade as an empty result. Different filter and page keys retain independent first-load states.

```tsx
const query = useQuery({ queryKey: ["records", filters], queryFn: loadRecords })
const hasData = query.data !== undefined

return (
  <PageShell>
    <Filters />
    <ResultTable>
      {!hasData && query.isPending ? (
        <SizeMatchedTableRows />
      ) : !hasData && query.isError ? (
        <RowsError onRetry={query.refetch} />
      ) : (
        <RecordRows records={query.data ?? []} />
      )}
    </ResultTable>
    {hasData && query.isError ? <BackgroundReadError /> : null}
  </PageShell>
)
```

## Cached or Paused Editable-Detail Guard

Retained `status: "success"` may still be fetching or paused. Capture `dataUpdatedAt` before each opening and hydrate only from a newer idle success for the current identity.

```tsx
const baselineRef = useRef<{ id: number; updatedAt: number } | null>(null)
const hydratedIdRef = useRef<number | null>(null)

// Call from the opening action, before enabling the detail query.
function openDetail(id: number) {
  baselineRef.current = {
    id,
    updatedAt: queryClient.getQueryState(detailKey(id))?.dataUpdatedAt ?? 0,
  }
  hydratedIdRef.current = null
  setSelectedId(id)
  setOpen(true)
}

useEffect(() => {
  const baseline = baselineRef.current
  if (
    !open || selectedId === null ||
    !baseline || baseline.id !== selectedId ||
    detailQuery.data?.id !== selectedId || !detailQuery.isSuccess ||
    detailQuery.fetchStatus !== "idle" ||
    detailQuery.dataUpdatedAt <= baseline.updatedAt ||
    hydratedIdRef.current === selectedId
  ) {
    return
  }

  hydratedIdRef.current = selectedId
  hydrateDraft(detailQuery.data)
}, [
  open, selectedId, detailQuery.data, detailQuery.isSuccess,
  detailQuery.fetchStatus, detailQuery.dataUpdatedAt, hydrateDraft,
])
```

Until this succeeds, Save, Delete, Replace All, parsing, registration, and other payload-dependent actions stay disabled. Mutation functions repeat the authority check and fail closed. Later background refetches never rebuild a dirty draft.

## Background Errors and Narrow Invalidation

Preserve already-hydrated editors and dirty drafts on background failure. Invalidate every retained view whose displayed facts changed, and no broader.

```tsx
await Promise.all([
  queryClient.invalidateQueries({ queryKey: recordKeys.list(), exact: true }),
  queryClient.invalidateQueries({ queryKey: recordKeys.detail(recordId), exact: true }),
  ...affectedCatalogIds.map((id) =>
    queryClient.invalidateQueries({ queryKey: catalogKeys.detail(id), exact: true }),
  ),
])
```

Clear QueryClient data at authenticated-session boundaries so retained data never crosses accounts.

## Required Policy Justification Checklist

- [ ] Is the default provider policy sufficient?
- [ ] If not, is this truly an operational or edit-opening fresh-retained consumer?
- [ ] If no-cache-authoritative is used, is retention genuinely prohibited and documented?
- [ ] Does initial pending or error gate only when data is absent?
- [ ] Do background refresh and errors preserve retained context and drafts?
- [ ] Can cached, fetching, or paused success enable a mutation? It must not.
- [ ] Does newer idle success hydrate exactly once per opening?
- [ ] Do mutation functions fail closed as well as controls?
- [ ] Are affected list, detail, and catalog keys invalidated narrowly?
- [ ] Are browser retention and server or HTTP freshness separate?
- [ ] Is QueryClient cleared at authenticated-session boundaries?
