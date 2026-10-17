# Mutations

## When to use

Use this when an edit payload must start from a newly completed, access-aware detail snapshot and the backend exposes a revision or equivalent concurrency token. Read fresh for each edit session, hydrate once, and return the revision for server-side authorization and version enforcement.

Ordinary create forms need no prerequisite detail read when their fields and catalogs are independently complete. They still need validation, pending protection, backend-confirmed success, and precise invalidation.

## Do not use

- Do not treat query success, cache age, timestamps, or update counters as authorization.
- Do not enable Save while the required refresh is fetching or paused.
- Do not let background refresh replace a hydrated or dirty draft.
- Do not announce success, close, or navigate before persistence is confirmed.
- Do not make invalidation failure reclassify a persisted write as failed.
- Do not add optimistic writes without a product decision covering rollback, conflicts, copy, and accessibility.

## Required product decisions

Define fields, validation, conflict handling, close behavior, success presentation, affected exact keys, and visible copy. The name DTO below is example-only. Mount the hook's owning component with `key={recordId + ":" + editSessionKey}` for every opening. The detail key must be service-owned; do not use external `setQueryData` calls as proof of a fresh read. `loadSnapshot` must return a current service snapshot and honor its signal; `updateRecord` must resolve only after persistence. The backend must atomically re-authorize the caller and reject a stale `expectedRevision`.

The example uses TanStack Query v5 APIs, including `getQueryState().dataUpdateCount`; verify support and lifecycle semantics in the installed version. `@/constants/query-options` illustrates a project-owned policy module, not a file supplied by this skill. Its `QueryPolicy.freshRetained` must require a new service read on each edit opening while permitting retained display data; use the target project's equivalent policy and aliases. Do not assume a missing policy module exists or replace the fresh-read invariant with cached success.

## Stable guarantees

- Only a successful data-update count newer than the opening baseline may hydrate at idle; that count is a client completion boundary, not authority.
- `canSave` and the mutation function both require current idle success; fetching, paused, and error states fail closed.
- A synchronous lock blocks duplicate submits before pending state renders.
- Write failure and background refresh preserve the draft.
- Confirmed persistence updates local state before exact invalidation starts.
- Invalidation failure becomes a separate warning, never a failed mutation.

## Complete example

```tsx
"use client";

import {
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { QueryPolicy } from "@/constants/query-options";

export type EditSnapshot = { id: string; name: string; revision: string };
export type EditService = {
  loadSnapshot(input: {
    id: string;
    signal: AbortSignal;
  }): Promise<EditSnapshot>;
  updateRecord(input: {
    id: string;
    name: string;
    expectedRevision: string;
  }): Promise<EditSnapshot>;
};
export type EditCopy = {
  loadFailed: string;
  saveFailed: string;
  saved: string;
  refreshFailed: string;
};
export type AuthoritativeNameEditOptions = {
  recordId: string;
  detailKey: QueryKey;
  affectedListKeys: readonly QueryKey[];
  service: EditService;
  copy: EditCopy;
};

type SaveInput = { snapshot: EditSnapshot; name: string };

export function useAuthoritativeNameEdit({
  recordId,
  detailKey,
  affectedListKeys,
  service,
  copy,
}: AuthoritativeNameEditOptions) {
  const queryClient = useQueryClient();
  const [baselineDataUpdateCount] = useState(
    () => queryClient.getQueryState(detailKey)?.dataUpdateCount ?? 0,
  );
  const hydratedRef = useRef(false);
  const submittingRef = useRef(false);
  const [snapshot, setSnapshot] = useState<EditSnapshot | null>(null);
  const [draftName, setDraftNameState] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const snapshotQuery = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => service.loadSnapshot({ id: recordId, signal }),
    ...QueryPolicy.freshRetained,
    retry: false,
  });
  const queryReady =
    snapshotQuery.data?.id === recordId &&
    snapshotQuery.isSuccess &&
    snapshotQuery.fetchStatus === "idle";

  useEffect(() => {
    const current = queryClient.getQueryState<EditSnapshot>(detailKey);
    if (
      hydratedRef.current ||
      current?.status !== "success" ||
      current.fetchStatus !== "idle" ||
      current.data?.id !== recordId ||
      current.dataUpdateCount <= baselineDataUpdateCount
    ) {
      return;
    }
    hydratedRef.current = true;
    setSnapshot(current.data);
    setDraftNameState(current.data.name);
  }, [
    baselineDataUpdateCount,
    detailKey,
    queryClient,
    recordId,
    snapshotQuery.data,
    snapshotQuery.fetchStatus,
    snapshotQuery.isSuccess,
  ]);

  const saveMutation = useMutation({
    mutationFn: ({ snapshot: submitted, name }: SaveInput) => {
      const current = queryClient.getQueryState<EditSnapshot>(detailKey);
      if (
        current?.status !== "success" ||
        current.fetchStatus !== "idle" ||
        current.data?.id !== recordId ||
        snapshot === null ||
        submitted.id !== recordId ||
        submitted.revision !== snapshot.revision ||
        name.length === 0 ||
        name === snapshot.name
      ) {
        throw new Error("Authoritative edit prerequisites are unavailable");
      }
      return service.updateRecord({
        id: submitted.id,
        name,
        expectedRevision: submitted.revision,
      });
    },
    onSuccess: (committed) => {
      setSnapshot(committed);
      setDraftNameState(committed.name);
      setNotice(copy.saved);
      setSaveError(null);
      const keys = [detailKey, ...affectedListKeys];
      void Promise.all(
        keys.map((queryKey) =>
          queryClient.invalidateQueries(
            { queryKey, exact: true },
            { throwOnError: true },
          ),
        ),
      ).catch(() => setRefreshError(copy.refreshFailed));
    },
    onError: () => {
      setSaveError(copy.saveFailed);
      setNotice(null);
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  const name = draftName.trim();
  const canSave =
    queryReady &&
    snapshot !== null &&
    name.length > 0 &&
    name !== snapshot.name &&
    !saveMutation.isPending &&
    !submittingRef.current;

  const setDraftName = (value: string) => {
    if (submittingRef.current || saveMutation.isPending) return;
    setDraftNameState(value);
    setNotice(null);
  };
  const retry = async () => {
    const result = await snapshotQuery.refetch();
    if (result.isSuccess) setRefreshError(null);
  };
  const submit = () => {
    if (!canSave || snapshot === null || submittingRef.current) return false;
    submittingRef.current = true;
    setSaveError(null);
    setNotice(null);
    setRefreshError(null);
    saveMutation.mutate({ snapshot, name });
    return true;
  };

  return {
    draftName,
    setDraftName,
    submit,
    retry,
    canSave,
    isInitialPending:
      snapshot === null &&
      (snapshotQuery.isFetching || !snapshotQuery.isError),
    initialError:
      snapshot === null &&
      snapshotQuery.isError &&
      !snapshotQuery.isFetching
        ? copy.loadFailed
        : null,
    isSaving: saveMutation.isPending,
    isRefreshing: snapshot !== null && snapshotQuery.isFetching,
    saveError,
    notice,
    refreshError:
      refreshError ??
      (snapshot !== null &&
      snapshotQuery.isError &&
      !snapshotQuery.isFetching
        ? copy.refreshFailed
        : null),
  };
}
```

Render a native form whose submit button uses `canSave`, and disable its input and submit control while `isSaving`. Use `isInitialPending`, `initialError`, and the returned messages for regional states. Render `retry` beside either initial or retained refresh failure; a successful retry clears `refreshError` without replacing the dirty draft. Call async `retry` with `void retry()` from an event handler. `submit` reports whether a write started, so duplicate protection is directly exercisable; `setDraftName` also rejects changes while persistence is in flight.

The service is the authority boundary. A successful refresh cannot grant permission or prevent a time-of-check/time-of-use race; the update must re-check authorization and revision on the server.

## Alternatives

For create, omit the detail query and revision gate. A Server Function may own the write and return structured errors. Optimistic cache updates require explicit rollback and reconciliation decisions. Without an atomic revision contract, choose a real concurrency contract or explicitly documented last-write-wins; never manufacture authority from timestamps.

## Verification

1. Delay, fail-and-retry, or offline-pause the read: retained success cannot enable Save; retry shows pending rather than the prior cold error.
2. Edit, then fail a focus/reconnect refresh: the draft remains, Save fails closed, `refreshError` and Retry remain visible; successful retry clears the error.
3. Call `submit` twice rapidly: the first returns `true`, the second `false`, and only one update carries the hydrated revision.
4. Reject the write: the draft remains and `saveError` appears.
5. Resolve the write, then reject invalidation: `notice` remains and `refreshError` appears separately.
6. Confirm only supplied detail/list keys are invalidated with `exact: true`.
