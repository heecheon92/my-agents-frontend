export const ONBOARDING_VERSION = 1;
export const DEFAULT_ONBOARDING_WAIT_TIMEOUT_MS = 4000;

export type OnboardingFlow = "guest" | "new-user";
export const ONBOARDING_FLOWS = [
  "guest",
  "new-user",
] as const satisfies readonly OnboardingFlow[];
export type OnboardingStatus = "idle" | "prompt" | "active";
export type OnboardingStep = {
  id: string;
  flow: OnboardingFlow;
  path: string;
  targetId: string;
  mobileTargetId?: string;
  /**
   * Tried in order when the primary target is absent or not rendered. The
   * evidence steps point at the agent-process panel, which only exists once a
   * conversation has an answer — and the tour lands on a fresh `/chat`, so on
   * a first run that step always waited four seconds and then apologised that
   * it could not find anything. The greeting is on screen in exactly that case.
   */
  fallbackTargetIds?: readonly string[];
  titleKey: string;
  bodyKey: string;
  waitTimeoutMs?: number;
};

export const onboardingSteps = [
  {
    id: "guest-limits",
    flow: "guest",
    path: "/chat",
    // The banner states the limits; the session card in the sidebar does not.
    targetId: "chat.guest-notice",
    fallbackTargetIds: [
      "service.guest-session-card",
      "service.guest-session-mobile",
    ],
    titleKey: "guestLimitsTitle",
    bodyKey: "guestLimitsBody",
  },
  {
    id: "guest-ask",
    flow: "guest",
    path: "/chat",
    targetId: "chat.composer",
    titleKey: "guestAskTitle",
    bodyKey: "guestAskBody",
  },
  {
    id: "guest-sources",
    flow: "guest",
    path: "/chat",
    targetId: "chat.source-selector",
    titleKey: "guestSourcesTitle",
    bodyKey: "guestSourcesBody",
  },
  {
    id: "guest-add-sources",
    flow: "guest",
    path: "/knowledge",
    targetId: "documents.upload-action",
    titleKey: "guestAddSourcesTitle",
    bodyKey: "guestAddSourcesBody",
  },
  {
    id: "guest-evidence",
    flow: "guest",
    path: "/chat",
    targetId: "chat.agent-process",
    fallbackTargetIds: ["chat.empty-state"],
    titleKey: "guestEvidenceTitle",
    bodyKey: "guestEvidenceBody",
  },
  {
    id: "new-knowledge-space",
    flow: "new-user",
    path: "/knowledge",
    targetId: "documents.knowledge-destination",
    mobileTargetId: "documents.browse-source-spaces",
    titleKey: "newKnowledgeSpaceTitle",
    bodyKey: "newKnowledgeSpaceBody",
  },
  {
    id: "new-upload-source",
    flow: "new-user",
    path: "/knowledge",
    targetId: "documents.upload-action",
    titleKey: "newUploadSourceTitle",
    bodyKey: "newUploadSourceBody",
  },
  {
    id: "new-chat-thread",
    flow: "new-user",
    path: "/chat",
    targetId: "chat.new-conversation",
    titleKey: "newChatThreadTitle",
    bodyKey: "newChatThreadBody",
  },
  {
    id: "new-select-knowledge",
    flow: "new-user",
    path: "/chat",
    targetId: "chat.source-selector",
    titleKey: "newSelectKnowledgeTitle",
    bodyKey: "newSelectKnowledgeBody",
  },
  {
    id: "new-ask-question",
    flow: "new-user",
    path: "/chat",
    targetId: "chat.composer",
    titleKey: "newAskQuestionTitle",
    bodyKey: "newAskQuestionBody",
  },
  {
    id: "new-review-evidence",
    flow: "new-user",
    path: "/chat",
    targetId: "chat.agent-process",
    fallbackTargetIds: ["chat.empty-state"],
    titleKey: "newReviewEvidenceTitle",
    bodyKey: "newReviewEvidenceBody",
  },
] as const satisfies readonly OnboardingStep[];

export function stepsForFlow(flow: OnboardingFlow): OnboardingStep[] {
  return onboardingSteps.filter((step) => step.flow === flow);
}

export function getStepByIndex(flow: OnboardingFlow, index: number) {
  return stepsForFlow(flow)[index];
}
