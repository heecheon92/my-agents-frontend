"use client";

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
import type {
  SourceActionsLocalization,
  SourceDeleteMutation,
  SourceDocumentContext,
} from "./types";

type SourceDeleteDialogProps = SourceDocumentContext & {
  deleteDocument: SourceDeleteMutation;
  localization: SourceActionsLocalization;
  onDeleteDocument: () => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SourceDeleteDialog({
  activeDocument,
  deleteDocument,
  localization,
  onDeleteDocument,
  onOpenChange,
  open,
}: SourceDeleteDialogProps) {
  const documentTitle =
    activeDocument?.title ?? localization.documents.noSelectedTitle;

  async function handleDelete() {
    const deleted = await onDeleteDocument();
    if (deleted) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-cal-error">
            {localization.documents.deleteTitle}
          </DialogTitle>
          <DialogDescription>
            {localization.documents.deleteConfirm.replace(
              "{title}",
              documentTitle,
            )}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-xl border border-cal-error/20 bg-cal-canvas p-3 text-sm leading-6 text-cal-muted">
          {localization.documents.deleteDescription}
        </p>
        {deleteDocument.error ? (
          <ErrorState error={deleteDocument.error} />
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteDocument.isPending}
          >
            {localization.common.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={!activeDocument || deleteDocument.isPending}
          >
            {localization.documents.deleteButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
