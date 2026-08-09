"use client";

import { useQuery } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { myAgentsAPI } from "@/services/my-agents";

/**
 * What the deployed backend accepts on a run.
 *
 * `retry: false` on purpose. A backend without the reasoning migration returns
 * 404 here, and that is a supported state rather than a transient failure —
 * the composer hides its controls and sends requests without the fields. There
 * is nothing to gain from retrying a missing endpoint on every mount.
 *
 * Cached for the session: the values change only with a redeploy.
 */
export function useReasoningCapabilities() {
  return useQuery({
    queryKey: MyAgentsQueryKeys.capabilities.reasoning(),
    queryFn: () => myAgentsAPI.capabilities.reasoning(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
