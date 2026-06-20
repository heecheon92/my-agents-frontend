"use client";

import type { ReactElement } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type SourceDeleteAlertDialogProps = {
  children: ReactElement;
  documentTitle: string;
  error: unknown;
  isPending: boolean;
  localization: {
    common: {
      cancel: string;
    };
    documents: {
      deleteButton: string;
      deleteConfirm: string;
      deleteTitle: string;
    };
  };
  onConfirm: () => void;
};

export function SourceDeleteAlertDialog({
  children,
  documentTitle,
  error,
  isPending,
  localization,
  onConfirm,
}: SourceDeleteAlertDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={children} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {localization.documents.deleteTitle}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {localization.documents.deleteConfirm.replace(
              "{title}",
              documentTitle,
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ErrorState error={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {localization.common.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            {localization.documents.deleteButton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
