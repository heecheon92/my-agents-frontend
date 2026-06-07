export const ONBOARDING_VERSION = 1;
export const DEFAULT_ONBOARDING_WAIT_TIMEOUT_MS = 4000;

export type OnboardingFlow = "guest" | "new-user";
export type OnboardingStatus = "idle" | "prompt" | "active";
export type OnboardingStep = {
  id: string;
  flow: OnboardingFlow;
  path: string;
  targetId: string;
  mobileTargetId?: string;
  titleKey: string;
  bodyKey: string;
  waitTimeoutMs?: number;
};

export const onboardingSteps = [
  {
    id: "guest-limits",
    flow: "guest",
    path: "/chat",
    targetId: "service.guest-session-card",
    mobileTargetId: "service.guest-session-mobile",
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
    path: "/documents",
    targetId: "documents.upload-dropzone",
    titleKey: "guestAddSourcesTitle",
    bodyKey: "guestAddSourcesBody",
  },
  {
    id: "guest-evidence",
    flow: "guest",
    path: "/chat",
    targetId: "chat.response-evidence",
    titleKey: "guestEvidenceTitle",
    bodyKey: "guestEvidenceBody",
  },
  {
    id: "new-knowledge-space",
    flow: "new-user",
    path: "/knowledge",
    targetId: "knowledge.create-form",
    titleKey: "newKnowledgeSpaceTitle",
    bodyKey: "newKnowledgeSpaceBody",
  },
  {
    id: "new-source-destination",
    flow: "new-user",
    path: "/documents",
    targetId: "documents.knowledge-destination",
    titleKey: "newSourceDestinationTitle",
    bodyKey: "newSourceDestinationBody",
  },
  {
    id: "new-upload-source",
    flow: "new-user",
    path: "/documents",
    targetId: "documents.upload-dropzone",
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
    targetId: "chat.response-evidence",
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
