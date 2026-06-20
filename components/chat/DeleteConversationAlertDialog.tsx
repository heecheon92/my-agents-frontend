"use client";

import { ErrorState } from "@/components/Status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Conversation } from "@/model/my-agents";
import type { Localization } from "@/utils/localization";

type DeleteConversationAlertDialogProps = {
  conversation?: Conversation;
  error: unknown;
  isPending: boolean;
  localization: Localization["chat"];
  onConfirm: (conversation: Conversation) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DeleteConversationAlertDialog({
  conversation,
  error,
  isPending,
  localization,
  onConfirm,
  onOpenChange,
  open,
}: DeleteConversationAlertDialogProps) {
  const title = conversation?.title ?? "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {localization.deleteConversationDialogTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {localization.deleteConversationConfirm.replace("{title}", title)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorState error={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {localization.cancelAction}
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={!conversation || isPending}
            onClick={() => {
              if (conversation) onConfirm(conversation);
            }}
          >
            {localization.deleteConversationAction}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
