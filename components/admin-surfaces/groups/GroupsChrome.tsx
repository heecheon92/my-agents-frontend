"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { useGroups } from "@/hooks/use-groups";
import { GroupBrowser } from "../GroupChrome";
import { PageCard } from "../shared";
import type { GroupsLocalization } from "./types";

type GroupsChromeProps = {
  activeGroupId?: string;
  children: ReactNode;
  groupCount: number;
  groups: ReturnType<typeof useGroups>;
  isGroupBrowserOpen: boolean;
  localization: GroupsLocalization;
  onCreateGroup: () => void;
  onGroupBrowserOpenChange: (open: boolean) => void;
  onSelectGroup: (groupId: string) => void;
};

export function GroupsChrome({
  activeGroupId,
  children,
  groupCount,
  groups,
  isGroupBrowserOpen,
  localization,
  onCreateGroup,
  onGroupBrowserOpenChange,
  onSelectGroup,
}: GroupsChromeProps) {
  const browser = (
    <GroupBrowser
      groups={groups}
      groupCount={groupCount}
      activeGroupId={activeGroupId}
      localization={localization}
      onCreateGroup={onCreateGroup}
      onSelectGroup={onSelectGroup}
    />
  );

  return (
    <>
      <PageCard
        fullWidth
        title={localization.groups.title}
        description={localization.groups.description}
      >
        <div className="flex min-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-3xl border border-cal-hairline bg-white shadow-[0_18px_60px_rgb(20_22_23/0.08)] lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-cal-hairline lg:flex">
            {browser}
          </aside>
          {children}
        </div>
      </PageCard>

      <Sheet open={isGroupBrowserOpen} onOpenChange={onGroupBrowserOpenChange}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-full max-w-sm gap-0 border-r border-cal-hairline bg-white p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{localization.groups.title}</SheetTitle>
            <SheetDescription>
              {localization.groups.groupCountDescription.replace(
                "{count}",
                String(groupCount),
              )}
            </SheetDescription>
          </SheetHeader>
          {browser}
        </SheetContent>
      </Sheet>
    </>
  );
}
