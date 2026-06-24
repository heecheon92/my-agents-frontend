"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, inputClassName, selectClassName } from "@/components/Field";
import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreatePublishRequest } from "@/hooks/use-groups";
import type { Group, KnowledgeBase } from "@/model/my-agents";
import type { Localization } from "@/utils/localization";

type SourceSpaceLifecycleLocalization = Localization["admin"];

type SourceSpaceMutationState = {
  error: unknown;
  isPending: boolean;
  reset?: () => void;
};

export function SourceSpaceRenameDialog({
  localization,
  mutation,
  onOpenChange,
  onRename,
  open,
  sourceSpace,
}: {
  localization: SourceSpaceLifecycleLocalization;
  mutation: SourceSpaceMutationState;
  onOpenChange: (open: boolean) => void;
  onRename: (name: string) => Promise<void>;
  open: boolean;
  sourceSpace?: KnowledgeBase;
}) {
  const [name, setName] = useState(sourceSpace?.name ?? "");

  useEffect(() => {
    if (open) setName(sourceSpace?.name ?? "");
  }, [open, sourceSpace?.name]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!sourceSpace || !nextName || mutation.isPending) return;
    await onRename(nextName);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) mutation.reset?.();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {localization.documents.renameSourceSpaceTitle}
          </DialogTitle>
          <DialogDescription>
            {localization.documents.renameSourceSpaceDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label={localization.documents.sourceSpaceNameLabel}>
            <input
              className={inputClassName}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              maxLength={160}
              required
            />
          </Field>
          {mutation.error ? <ErrorState error={mutation.error} /> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {localization.common.cancel}
            </Button>
            <Button type="submit" disabled={!name.trim() || mutation.isPending}>
              {mutation.isPending
                ? localization.documents.renameSourceSpacePending
                : localization.documents.renameSourceSpaceAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SourceSpaceDeleteDialog({
  localization,
  mutation,
  onDelete,
  onOpenChange,
  open,
  sourceSpace,
}: {
  localization: SourceSpaceLifecycleLocalization;
  mutation: SourceSpaceMutationState;
  onDelete: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sourceSpace?: KnowledgeBase;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) mutation.reset?.();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {localization.documents.deleteSourceSpaceTitle}
          </DialogTitle>
          <DialogDescription>
            {localization.documents.deleteSourceSpaceDescription.replace(
              "{name}",
              sourceSpace?.name ??
                localization.documents.noSelectedSourceSpaceTitle,
            )}
          </DialogDescription>
        </DialogHeader>
        {mutation.error ? <ErrorState error={mutation.error} /> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {localization.common.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onDelete()}
            disabled={!sourceSpace || mutation.isPending}
          >
            {mutation.isPending
              ? localization.documents.deleteSourceSpacePending
              : localization.documents.deleteSourceSpaceAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SourceSpaceShareDialog({
  groups,
  localization,
  onOpenChange,
  open,
  sourceSpace,
}: {
  groups: Group[];
  localization: SourceSpaceLifecycleLocalization;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sourceSpace?: KnowledgeBase;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const createPublishRequest = useCreatePublishRequest(selectedGroupId);

  useEffect(() => {
    if (!open) return;
    setSelectedGroupId(groups[0]?.id ?? "");
    createPublishRequest.reset();
  }, [createPublishRequest.reset, groups, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceSpace || !selectedGroupId || createPublishRequest.isPending) {
      return;
    }
    try {
      await createPublishRequest.mutateAsync({
        source_knowledge_base_id: sourceSpace.id,
      });
      toast.success(localization.documents.shareSourceSpaceSuccess);
      onOpenChange(false);
    } catch {
      toast.error(localization.documents.shareSourceSpaceFailed);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) createPublishRequest.reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {localization.documents.shareSourceSpaceTitle}
          </DialogTitle>
          <DialogDescription>
            {localization.documents.shareSourceSpaceDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field
            label={localization.documents.shareTargetGroupLabel}
            hint={localization.documents.shareSourceSpaceHint}
          >
            <select
              className={selectClassName}
              value={selectedGroupId}
              onChange={(event) =>
                setSelectedGroupId(event.currentTarget.value)
              }
              required
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {localization.groups.roles[group.role]}
                </option>
              ))}
            </select>
          </Field>
          {groups.length === 0 ? (
            <p className="rounded-xl border border-cal-hairline bg-cal-canvas p-3 text-sm leading-6 text-cal-muted">
              {localization.documents.shareNoGroupsDescription}
            </p>
          ) : null}
          {createPublishRequest.error ? (
            <ErrorState error={createPublishRequest.error} />
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createPublishRequest.isPending}
            >
              {localization.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={
                !sourceSpace ||
                !selectedGroupId ||
                createPublishRequest.isPending
              }
            >
              {createPublishRequest.isPending
                ? localization.documents.shareSourceSpacePending
                : localization.documents.shareSourceSpaceAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
