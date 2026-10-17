# Async UI Boundaries

Use this reference when changing loading, Skeletons, lists, tables, cards, master-detail layouts, retained results, or performance-sensitive rendering.

## Map the Visible Async Boundary

For every query, identify the smallest region whose content actually depends on it.

Loading and errors belong to that region—not automatically to the provider, page, or application shell.

### Bad: detail loading replaces the entire shell

```tsx
function Provider({ children }: Props) {
  const listQuery = useQuery(listOptions)
  const detailQuery = useQuery(detailOptions(selectedId))

  if (listQuery.isPending || detailQuery.isPending) {
    return <Spinner />
  }

  return <Context.Provider value={value}>{children}</Context.Provider>
}
```

This unmounts navigation, lists, scroll position, selected styling, and local state whenever detail changes.

### Good: the stable shell always mounts

```tsx
function Provider({ children }: Props) {
  const listQuery = useQuery(listOptions)
  const hasListData = listQuery.data !== undefined

  return (
    <Context.Provider
      value={{
        list: listQuery.data ?? [],
        isListPending: !hasListData && !listQuery.isError,
        listError: !hasListData ? listQuery.error : null,
        retryList: listQuery.refetch,
      }}
    >
      {children}
    </Context.Provider>
  )
}

function ListRegion() {
  const { list, isListPending, listError, retryList } = useRecords()

  return (
    <PageShell>
      <ListHeader actionsDisabled={isListPending || Boolean(listError)} />
      <div className={finalListContainer}>
        {isListPending ? (
          <SizeMatchedRows />
        ) : listError ? (
          <ListError error={listError} onRetry={retryList} />
        ) : (
          <RecordRows records={list} />
        )}
      </div>
    </PageShell>
  )
}
```

Known chrome, controls, columns, tabs, rails, and content frames paint immediately. Only the query-owned rows, cards, fields, or values enter pending/error states. Initial errors keep the shell mounted and Retry the exact failed query. Retained background failures preserve visible data.

## Default Initial Paint

Paint immediately when known:

- page or Sheet title,
- navigation and rail,
- selected-row highlight,
- tabs,
- field labels,
- section headings,
- known summary identity when design-backed,
- action placement in a disabled state,
- empty, loading, and error region boundaries.

Use Skeletons only for unresolved values and rows.

### Bad

```tsx
return query.isPending ? <Spinner /> : <LargeEditor data={query.data} />
```

### Good

```tsx
return (
  <EditorShell>
    <EditorHeader title={copy.title} saveDisabled />
    {queryPending ? (
      <>
        <FieldSkeleton label={copy.name} />
        <FieldSkeleton label={copy.organization} />
        <ListSkeleton title={copy.permissions} rows={4} />
      </>
    ) : (
      <EditorFields draft={draft} />
    )}
  </EditorShell>
)
```

Skeletons must preserve the final component's size, not merely suggest its content. Reuse the final owning container, grid or flex structure, padding, gaps, row or card count, line boxes, column count, and responsive branch. Match fixed or minimum heights and widths when the loaded component already defines them. A Skeleton-to-content swap should not move surrounding UI.

For tables, render Skeleton cells inside the real row and cell components and match the final row height. For cards, reuse the final card container and its padding. For labeled values, keep the real label and replace only the value box. Build separate desktop and mobile Skeleton silhouettes when the final layouts differ.

Do not use a centered whole-region spinner when the final silhouette is known. A Next.js route `loading.tsx` may reuse the same size-matched route-local state for server transitions, but it complements rather than replaces client-query regional boundaries.

## Error and Retry UX

Initial-read errors stay in the region that failed.

The error region must preserve:

- surrounding page or Sheet shell,
- title and context,
- Close or alternate navigation,
- Retry for the exact query.

During retry, hide or disable Retry and show the shape-matched Skeleton again.

Do not use a toast-only error for a missing primary detail body.

Background-refetch failure after an editor is hydrated should usually preserve the editor rather than replacing it with the initial error state.

## Lists and Master–Detail Pages

When selecting a list item:

- keep the list component mounted,
- update URL and selected styling immediately,
- preserve scroll position,
- load only the detail region,
- remount the editor by `key={recordId}` only when a clean record-specific draft reset is intentional.

A provider-level detail spinner is a common bug because it destroys the stable list subtree.

## Tables, Cards, and Page Results

For initial collection reads:

- render controls and headings immediately,
- use table-row Skeletons matching column count and row height,
- use card Skeletons matching card dimensions,
- keep empty state distinct from loading,
- keep query errors distinct from empty data,
- preserve prior results during background refresh when that does not misrepresent a changed explicit filter.

## Performance Rules

- Keep stable list and shell components mounted.
- Memoize genuinely repeated expensive derivations, not simple expressions.
- Build `Map` or `Set` indexes once when repeated lookup would otherwise be quadratic.
- Cap retained live or event collections.
- Avoid new objects and functions only when they cause measured subscription or memo churn; do not obscure code for speculative micro-optimization.
- Use `content-visibility` for long static row or card lists when compatible.
- Never allocate or recompute server-derived mappings inside nested render loops when they can be prepared once.
