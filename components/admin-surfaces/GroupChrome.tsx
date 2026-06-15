"use client";

import { NetworkIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { EmptyState, ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import type { useGroups } from "@/hooks/use-groups";
import { cn } from "@/lib/utils";
import { groupHref } from "./shared";

type GroupBrowserLocalization = {
  common: {
    loading: string;
  };
  groups: {
    title: string;
    createButton: string;
    empty: string;
    emptyDescription: string;
    groupCountDescription: string;
    roles: Record<string, string>;
  };
};

type GroupBrowserProps = {
  groups: ReturnType<typeof useGroups>;
  groupCount: number;
  activeGroupId?: string;
  localization: GroupBrowserLocalization;
  onCreateGroup: () => void;
  onSelectGroup: (groupId: string) => void;
};

export function GroupBrowser({
  groups,
  groupCount,
  activeGroupId,
  localization,
  onCreateGroup,
  onSelectGroup,
}: GroupBrowserProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-cal-hairline px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-cal-ink">
              {localization.groups.title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-cal-muted">
              {localization.groups.groupCountDescription.replace(
                "{count}",
                String(groupCount),
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={localization.groups.createButton}
            onClick={onCreateGroup}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {groups.isLoading ? (
          <p className="px-3 text-sm text-cal-muted">
            {localization.common.loading}
          </p>
        ) : null}
        {groups.error ? <ErrorState error={groups.error} /> : null}
        {!groups.isLoading && groupCount === 0 ? (
          <div className="px-1">
            <EmptyState
              title={localization.groups.empty}
              description={localization.groups.emptyDescription}
            />
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={onCreateGroup}
            >
              {localization.groups.createButton}
            </Button>
          </div>
        ) : null}
        <div className="grid gap-1">
          {groups.data?.map((group) => (
            <Link
              key={group.id}
              href={groupHref(group.id)}
              onClick={() => onSelectGroup(group.id)}
              aria-current={activeGroupId === group.id ? "page" : undefined}
              className={cn(
                "flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                activeGroupId === group.id
                  ? "bg-cal-primary text-white shadow-[0_10px_24px_rgb(20_33_61/0.16)]"
                  : "text-cal-ink hover:bg-cal-surface-soft",
              )}
            >
              <NetworkIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {group.name}
              </span>
              <span className="shrink-0 text-xs opacity-80">
                {localization.groups.roles[group.role]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GroupSummaryCard({
  title,
  value,
  description,
  action,
}: {
  title: string;
  value: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cal-hairline bg-white p-4 shadow-[0_10px_30px_rgb(20_22_23/0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-cal-ink">
            {value}
          </p>
        </div>
        {action}
      </div>
      <p className="mt-2 text-sm leading-6 text-cal-muted">{description}</p>
    </section>
  );
}

export function renderStatusFilterButton<T extends string>({
  value,
  activeValue,
  label,
  onSelect,
}: {
  value: T;
  activeValue: T;
  label: string;
  onSelect: (value: T) => void;
}) {
  const isActive = value === activeValue;
  return (
    <Button
      key={value}
      type="button"
      size="sm"
      variant={isActive ? "default" : "outline"}
      aria-pressed={isActive}
      onClick={() => onSelect(value)}
    >
      {label}
    </Button>
  );
}
