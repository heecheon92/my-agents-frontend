"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  ONBOARDING_VERSION,
  type OnboardingFlow,
  type OnboardingStatus,
} from "./onboarding-steps";

export type OnboardingDecision = {
  completed?: boolean;
  dismissed?: boolean;
  updatedAt: string;
};

type OnboardingPersistentState = {
  version: number;
  authDecisions: Record<
    string,
    Partial<Record<OnboardingFlow, OnboardingDecision>>
  >;
};

type OnboardingRuntimeState = {
  activeFlow: OnboardingFlow | null;
  activeStepIndex: number;
  status: OnboardingStatus;
  isHydrated: boolean;
  targets: Record<string, HTMLElement>;
};

type OnboardingActions = {
  setHydrated: (isHydrated: boolean) => void;
  registerTarget: (targetId: string, element: HTMLElement) => void;
  unregisterTarget: (targetId: string, element: HTMLElement) => void;
  prompt: (flow: OnboardingFlow) => void;
  start: (flow: OnboardingFlow) => void;
  next: (totalSteps: number) => void;
  back: () => void;
  skip: (identityBucket?: string) => void;
  complete: (identityBucket?: string) => void;
  resetRuntime: () => void;
  markDismissed: (flow: OnboardingFlow, identityBucket: string) => void;
  markCompleted: (flow: OnboardingFlow, identityBucket: string) => void;
};

export type OnboardingStore = OnboardingPersistentState &
  OnboardingRuntimeState &
  OnboardingActions;

const initialPersistentState: OnboardingPersistentState = {
  version: ONBOARDING_VERSION,
  authDecisions: {},
};

const initialRuntimeState: OnboardingRuntimeState = {
  activeFlow: null,
  activeStepIndex: 0,
  status: "idle",
  isHydrated: false,
  targets: {},
};

const ONBOARDING_IDENTITY_SALT_KEY = "my-agents:onboarding:identity-salt:v1";

function nowIso() {
  return new Date().toISOString();
}

function hashToHex(value: string, seed: number) {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getOnboardingIdentitySalt() {
  if (typeof window === "undefined") return "server-render";
  try {
    const existing = window.localStorage.getItem(ONBOARDING_IDENTITY_SALT_KEY);
    if (existing) return existing;
    const bytes = new Uint32Array(2);
    window.crypto.getRandomValues(bytes);
    const salt = Array.from(bytes, (value) =>
      value.toString(16).padStart(8, "0"),
    ).join("");
    window.localStorage.setItem(ONBOARDING_IDENTITY_SALT_KEY, salt);
    return salt;
  } catch {
    return "local-storage-unavailable";
  }
}

export function opaqueIdentityBucket(
  userId: string,
  salt = getOnboardingIdentitySalt(),
) {
  const saltedValue = `${salt}:${userId}`;
  return `auth:${hashToHex(saltedValue, 0x811c9dc5)}${hashToHex(
    saltedValue,
    0x9e3779b9,
  )}`;
}

export function guestSessionKey(flow: OnboardingFlow) {
  return `my-agents:onboarding:guest:${flow}:v${ONBOARDING_VERSION}`;
}

export function getGuestSessionDecision(flow: OnboardingFlow) {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(guestSessionKey(flow));
  if (!value) return null;
  try {
    return JSON.parse(value) as OnboardingDecision;
  } catch {
    return null;
  }
}

export function markGuestSessionDecision(
  flow: OnboardingFlow,
  decision: Pick<OnboardingDecision, "completed" | "dismissed">,
) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    guestSessionKey(flow),
    JSON.stringify({ ...decision, updatedAt: nowIso() }),
  );
}

export function serializeOnboardingPersistence(state: OnboardingStore) {
  return {
    version: state.version,
    authDecisions: state.authDecisions,
  } satisfies OnboardingPersistentState;
}

function recordDecision(
  state: OnboardingStore,
  flow: OnboardingFlow,
  identityBucket: string,
  decision: Pick<OnboardingDecision, "completed" | "dismissed">,
) {
  return {
    authDecisions: {
      ...state.authDecisions,
      [identityBucket]: {
        ...(state.authDecisions[identityBucket] ?? {}),
        [flow]: { ...decision, updatedAt: nowIso() },
      },
    },
  };
}

function persistDecision(flow: OnboardingFlow, identityBucket?: string) {
  if (!identityBucket) return;
  if (identityBucket === "guest:session") {
    markGuestSessionDecision(flow, { completed: true });
    return;
  }
  useOnboardingStore.getState().markCompleted(flow, identityBucket);
}

function dismissDecision(flow: OnboardingFlow, identityBucket?: string) {
  if (!identityBucket) return;
  if (identityBucket === "guest:session") {
    markGuestSessionDecision(flow, { dismissed: true });
    return;
  }
  useOnboardingStore.getState().markDismissed(flow, identityBucket);
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...initialPersistentState,
      ...initialRuntimeState,
      setHydrated: (isHydrated) => set({ isHydrated }),
      registerTarget: (targetId, element) =>
        set((state) => ({
          targets: { ...state.targets, [targetId]: element },
        })),
      unregisterTarget: (targetId, element) =>
        set((state) => {
          if (state.targets[targetId] !== element) return state;
          const { [targetId]: _removed, ...targets } = state.targets;
          return { targets };
        }),
      prompt: (flow) =>
        set({ activeFlow: flow, activeStepIndex: 0, status: "prompt" }),
      start: (flow) =>
        set({ activeFlow: flow, activeStepIndex: 0, status: "active" }),
      next: (totalSteps) =>
        set((state) => ({
          activeStepIndex: Math.min(totalSteps - 1, state.activeStepIndex + 1),
        })),
      back: () =>
        set((state) => ({
          activeStepIndex: Math.max(0, state.activeStepIndex - 1),
        })),
      skip: (identityBucket) => {
        const flow = get().activeFlow;
        if (flow) dismissDecision(flow, identityBucket);
        set({ activeFlow: null, activeStepIndex: 0, status: "idle" });
      },
      complete: (identityBucket) => {
        const flow = get().activeFlow;
        if (flow) persistDecision(flow, identityBucket);
        set({ activeFlow: null, activeStepIndex: 0, status: "idle" });
      },
      resetRuntime: () =>
        set({ ...initialRuntimeState, isHydrated: get().isHydrated }),
      markDismissed: (flow, identityBucket) =>
        set((state) =>
          recordDecision(state, flow, identityBucket, { dismissed: true }),
        ),
      markCompleted: (flow, identityBucket) =>
        set((state) =>
          recordDecision(state, flow, identityBucket, { completed: true }),
        ),
    }),
    {
      name: "my-agents:onboarding:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: serializeOnboardingPersistence,
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
