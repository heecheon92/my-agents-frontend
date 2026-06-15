import { describe, expect, it } from "vitest";
import * as AdminSurfaces from "@/components/AdminSurfaces";
import * as ChatWorkspace from "@/components/ChatWorkspace";
import * as EvidencePanel from "@/components/chat/EvidencePanel";
import * as Sidebar from "@/components/ui/sidebar";

describe("component public export contracts", () => {
  it("keeps admin surface barrel exports stable", () => {
    expect(AdminSurfaces).toMatchObject({
      GroupsSurface: expect.any(Function),
      SourcesSurface: expect.any(Function),
    });
  });

  it("keeps chat workspace behavior helpers and component exports stable", () => {
    expect(ChatWorkspace).toMatchObject({
      ACTIVE_RUN_STALE_NOTICE_AFTER_MS: 30_000,
      CHAT_SCROLL_REGION_CLASS_NAME: expect.any(String),
      CHAT_WORKSPACE_PANEL_CLASS_NAME: expect.any(String),
      ChatWorkspace: expect.any(Function),
      REPLAY_ICON_PENDING_CLASS_NAME: expect.any(String),
      buildActiveKnowledgeBaseSelection: expect.any(Function),
      getAgentTraceStageKeys: expect.any(Function),
      getConversationCardClassName: expect.any(Function),
      getLatestAssistantMessageId: expect.any(Function),
      getNextConversationIdAfterDelete: expect.any(Function),
      isActiveAgentRunStatus: expect.any(Function),
      isConversationRunAlreadyActiveError: expect.any(Function),
      isObservedActiveRunStale: expect.any(Function),
      sanitizeActivityEventPayload: expect.any(Function),
    });
  });

  it("keeps evidence panel helper and component exports stable", () => {
    expect(EvidencePanel).toMatchObject({
      CurrentAgentTraceStepPanel: expect.any(Function),
      EvidencePanel: expect.any(Function),
      getAgentTraceStageKeys: expect.any(Function),
      getCurrentAgentTraceStep: expect.any(Function),
      sanitizeActivityEventPayload: expect.any(Function),
    });
  });

  it("keeps sidebar shadcn-compatible named exports stable", () => {
    expect(Sidebar).toMatchObject({
      Sidebar: expect.any(Function),
      SidebarContent: expect.any(Function),
      SidebarFooter: expect.any(Function),
      SidebarGroup: expect.any(Function),
      SidebarGroupAction: expect.any(Function),
      SidebarGroupContent: expect.any(Function),
      SidebarGroupLabel: expect.any(Function),
      SidebarHeader: expect.any(Function),
      SidebarInput: expect.any(Function),
      SidebarInset: expect.any(Function),
      SidebarMenu: expect.any(Function),
      SidebarMenuAction: expect.any(Function),
      SidebarMenuBadge: expect.any(Function),
      SidebarMenuButton: expect.any(Function),
      SidebarMenuItem: expect.any(Function),
      SidebarMenuSkeleton: expect.any(Function),
      SidebarMenuSub: expect.any(Function),
      SidebarMenuSubButton: expect.any(Function),
      SidebarMenuSubItem: expect.any(Function),
      SidebarProvider: expect.any(Function),
      SidebarRail: expect.any(Function),
      SidebarSeparator: expect.any(Function),
      SidebarTrigger: expect.any(Function),
      useSidebar: expect.any(Function),
    });
  });
});
