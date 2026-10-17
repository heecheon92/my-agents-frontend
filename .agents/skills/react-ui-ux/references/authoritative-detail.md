# Authoritative Detail and Mutations

Use this reference when changing overlays, editable detail, draft hydration, permissions, credentials, destructive actions, or complete-replacement mutations.

The examples use TanStack Query v5-style lifecycle APIs and illustrative component/service contracts. Confirm the installed version and adapt them to the target project while preserving the fresh-current-identity, idle-success, hydrate-once invariant; reuse a tested project helper when available.

## Open-First Detail Sheets and Drawers

A row activation must synchronously record selection and open the overlay. Never await detail before opening.

### Bad

```tsx
async function openDetail(id: number) {
  const detail = await queryClient.fetchQuery(detailOptions(id))
  dispatch({ type: "hydrateDetail", detail })
  dispatch({ type: "openDetail", id })
}
```

On failure, nothing opens. The interface appears stunned.

### Good

```tsx
function openDetail(id: number) {
  dispatch({ type: "openDetail", id })
}

const detailQuery = useQuery({
  ...detailOptions(selectedId),
  enabled: sheetOpen && selectedId !== null,
  staleTime: 0,
  refetchOnMount: "always",
  retry: false,
})
```

The Sheet renders:

```tsx
<Sheet open={sheetOpen} onOpenChange={handleOpenChange}>
  <SheetContent>
    <SheetHeader>{/* static title and Close */}</SheetHeader>

    {detailReady ? (
      <EditableDetail />
    ) : initialDetailError ? (
      <InlineDetailError onRetry={detailQuery.refetch} onClose={close} />
    ) : (
      <ShapeMatchedDetailSkeleton />
    )}
  </SheetContent>
</Sheet>
```

Rules:

- list identity may address the request and support design-backed identity text,
- list relationships, permissions, and credentials are never authoritative detail,
- initial failure keeps the overlay open,
- Retry replaces error with Skeleton while pending,
- Close remains available unless a mutation is actively committing,
- Save, Delete, link-edit, and credential actions are disabled or hidden until detail success.

## Fresh Authoritative Hydration

TanStack Query can expose cached data with `status: "success"` while a required fresh request is `fetching` or `paused` offline. Do not authorize editing from `isSuccess` alone.

At the start of each selection or opening, capture the cached `dataUpdatedAt` baseline. Accept data only when:

- it belongs to the current selected ID,
- the query is successful,
- `fetchStatus === "idle"`,
- `dataUpdatedAt` is newer than the opening baseline,
- that selection has not already hydrated its draft.

### Example guard

```tsx
const baselineRef = useRef<{ id: number; dataUpdatedAt: number } | null>(null)
const hydratedIdRef = useRef<number | null>(null)

useEffect(() => {
  if (!open || selectedId === null) {
    baselineRef.current = null
    hydratedIdRef.current = null
    return
  }

  if (baselineRef.current?.id === selectedId) return

  baselineRef.current = {
    id: selectedId,
    dataUpdatedAt:
      queryClient.getQueryState(detailKey(selectedId))?.dataUpdatedAt ?? 0,
  }
  hydratedIdRef.current = null
}, [open, queryClient, selectedId])

useEffect(() => {
  const baseline = baselineRef.current
  if (
    !detailQuery.data ||
    !detailQuery.isSuccess ||
    detailQuery.fetchStatus !== "idle" ||
    baseline?.id !== selectedId ||
    detailQuery.dataUpdatedAt <= baseline.dataUpdatedAt ||
    hydratedIdRef.current === selectedId
  ) {
    return
  }

  hydratedIdRef.current = selectedId
  dispatch({ type: "hydrateDetail", detail: detailQuery.data })
}, [
  detailQuery.data,
  detailQuery.dataUpdatedAt,
  detailQuery.fetchStatus,
  detailQuery.isSuccess,
  dispatch,
  selectedId,
])
```

Why this matters:

- cached success must not bypass the Skeleton,
- offline-paused fetch must not enable mutations,
- reconnect success may hydrate once,
- later background refetch must not overwrite user edits.

If the project supplies a tested shared helper for this invariant, reuse it.

## Preserve Drafts During Background Refresh

Initial fresh detail creates the draft once per selected record. After the user edits:

- do not rebuild the draft on focus refetch,
- do not replace local form state because query data changed,
- do not restore the initial Skeleton,
- preserve the visible editor and optionally show a subtle region-level refresh indicator.

Mutation success may deliberately hydrate from the mutation response if that response is authoritative.

## Mutation Gating

Every mutation must defend itself twice:

1. UI control disabled or hidden until prerequisites succeed.
2. Mutation function checks the same invariant and throws or fails closed.

```tsx
const saveMutation = useMutation({
  mutationFn: async () => {
    if (!detailReady || !draft) {
      throw new Error("Fresh detail is unavailable")
    }
    return service.update(draft)
  },
})
const canSave =
  detailReady &&
  catalogsReady &&
  hasChanges &&
  validation.ok &&
  !saveMutation.isPending

```

Never allow an unresolved relationship list to become an empty Replace All payload.

Close, cache invalidation, navigation, and success toast happen only after backend-confirmed mutation success.
