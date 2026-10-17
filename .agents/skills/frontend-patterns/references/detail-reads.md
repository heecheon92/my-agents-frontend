# Detail reads

## When to use

Use this pattern for a read-only detail Sheet whose fields may come from a retained client query. Open the Sheet in the same event that records the selected ID; do not await the read. The title and Close control render immediately, while only the values enter loading or error states.

The default retained policy is appropriate when showing a recently cached detail is honest. A background refresh may update it, but a network round trip is not required for every read-only opening. Use a fresh-authoritative edit pattern instead when detail fields will seed a write payload.

## Do not use

- Do not treat a list row or summary DTO as complete detail.
- Do not delay opening until `loadDetail` resolves.
- Do not replace retained data with a Skeleton or blocking error during refresh.
- Do not add edit, delete, permission, or credential actions to this read-only boundary.
- Do not infer mutation authority from query success, cache age, or `dataUpdatedAt`.

## Required product decisions

The product must decide the detail fields, whether retained values are acceptable, the query identity, Sheet dimensions, retry policy, and all visible copy. The DTO and `recordKeys` below are example-only contracts, not mandatory product defaults. The injected loader must map the real service response and honor its `AbortSignal`.

The code illustrates TanStack Query v5 and project UI primitives, including the shown Sheet composition APIs. Verify installed library/component versions and aliases; adapt to existing equivalents rather than assuming `showCloseButton`, `render`, or these imports are universally available. `QueryPolicy` names mentioned below describe optional project freshness policies, not modules supplied by this skill.

## Stable guarantees

- Selection and Sheet opening are synchronous; the request never blocks the overlay.
- Static title, description, and Close remain available in every state.
- Cold loading and retry loading use a local, shape-matched body.
- Initial failure stays inside the Sheet and retries only this query.
- Retained data stays visible during refresh and refresh failure.
- This component exposes no write authority.

## Complete example

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export type ReadOnlyRecordDetail = {
  id: string;
  displayName: string;
  statusLabel: string;
  ownerLabel: string;
};

export type ReadOnlyDetailCopy = {
  title: string;
  description: string;
  displayNameLabel: string;
  statusLabel: string;
  ownerLabel: string;
  close: string;
  loadFailed: string;
  retry: string;
  refreshing: string;
  refreshFailed: string;
};

export type ReadOnlyDetailSheetProps = {
  open: boolean;
  recordId: string | null;
  onOpenChange: (open: boolean) => void;
  loadDetail: (
    input: { id: string; signal: AbortSignal },
  ) => Promise<ReadOnlyRecordDetail>;
  copy: ReadOnlyDetailCopy;
};

export const recordKeys = {
  detail: (id: string) => ["records", "detail", id] as const,
};

function DetailSkeleton({ copy }: { copy: ReadOnlyDetailCopy }) {
  const labels = [
    copy.displayNameLabel,
    copy.statusLabel,
    copy.ownerLabel,
  ];

  return (
    <dl className="grid gap-4" aria-busy="true">
      {labels.map((label) => (
        <div className="grid gap-1" key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="min-h-9 rounded-md border px-3 py-2">
            <Skeleton className="h-5 w-2/3" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DetailValues({
  detail,
  copy,
}: {
  detail: ReadOnlyRecordDetail;
  copy: ReadOnlyDetailCopy;
}) {
  const rows = [
    [copy.displayNameLabel, detail.displayName],
    [copy.statusLabel, detail.statusLabel],
    [copy.ownerLabel, detail.ownerLabel],
  ] as const;

  return (
    <dl className="grid gap-4">
      {rows.map(([label, value]) => (
        <div className="grid gap-1" key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="min-h-9 rounded-md border px-3 py-2">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReadOnlyDetailSheet({
  open,
  recordId,
  onOpenChange,
  loadDetail,
  copy,
}: ReadOnlyDetailSheetProps) {
  const detailQuery = useQuery({
    queryKey: recordKeys.detail(recordId ?? "unselected"),
    queryFn: ({ signal }) => {
      if (recordId === null) {
        throw new Error("A selected record is required");
      }
      return loadDetail({ id: recordId, signal });
    },
    enabled: open && recordId !== null,
    retry: false,
  });

  const hasData = detailQuery.data !== undefined;
  const showSkeleton =
    !hasData && (detailQuery.isFetching || !detailQuery.isError);
  const showInitialError = !hasData && detailQuery.isError && !detailQuery.isFetching;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-3 px-4" aria-busy={detailQuery.isFetching}>
          {showSkeleton ? <DetailSkeleton copy={copy} /> : null}

          {showInitialError ? (
            <div className="grid gap-3 rounded-md border p-4" role="alert">
              <p>{copy.loadFailed}</p>
              <Button
                type="button"
                variant="outline"
                disabled={detailQuery.isFetching}
                onClick={() => void detailQuery.refetch()}
              >
                {copy.retry}
              </Button>
            </div>
          ) : null}

          {detailQuery.data ? (
            <DetailValues detail={detailQuery.data} copy={copy} />
          ) : null}

          {hasData && detailQuery.isFetching ? (
            <p className="text-sm text-muted-foreground" role="status">
              {copy.refreshing}
            </p>
          ) : null}

          {hasData && detailQuery.isError && !detailQuery.isFetching ? (
            <div className="flex items-center justify-between gap-3" role="status">
              <p className="text-sm text-muted-foreground">
                {copy.refreshFailed}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void detailQuery.refetch()}
              >
                {copy.retry}
              </Button>
            </div>
          ) : null}
        </div>

        <SheetFooter>
          <SheetClose render={<Button type="button" variant="outline" />}>
            {copy.close}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

The client-owned caller supplies the service and copy, then handles row activation with `setRecordId(id); setOpen(true)`. Do not pass ordinary function props across a Server-to-Client boundary; compose this entry point from a client module or client service context.

## Alternatives

A server-rendered route detail is preferable when the detail is navigable and does not depend on client-only selection. Use `QueryPolicy.freshRetained` plus an authoritative edit boundary only when a write needs a newly completed snapshot. Use `noCacheAuthoritative` only when inactive retention is explicitly prohibited, not as a substitute for invalidation.

## Verification

1. Activate a row with a delayed loader: the Sheet, title, description, Close, and three value Skeletons appear immediately.
2. Reject the cold read: the Sheet stays open and Retry invokes only the selected detail query.
3. Resolve once, then refetch slowly: old values remain visible with the refresh status.
4. Reject that background refetch: old values remain visible with a non-blocking retry affordance.
5. Confirm the loader receives the query `AbortSignal` and its transport honors cancellation when the query is superseded or unmounted.
6. Confirm the rendered boundary contains no edit or destructive action.
