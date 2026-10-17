"use client";

import { useQuery } from "@tanstack/react-query";
import { MyAgentsQueryKeys } from "@/constants/query-keys";
import { durableRunsEnabledFromHealth } from "@/model/my-agents";
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

/**
 * Whether new answers and regenerations are admitted as durable runs.
 *
 * `false` while health is loading or failing and whenever the flag is absent:
 * the legacy routes are the default. It selects the route for NEW work only —
 * an existing run is joined and resumed by its own `execution_mode`, whatever
 * this says.
 */
export function useDurableRunsEnabled() {
  const health = useQuery({
    queryKey: MyAgentsQueryKeys.health(),
    queryFn: () => myAgentsAPI.health(),
    staleTime: 60 * 1000,
  });
  return durableRunsEnabledFromHealth(health.data);
}
