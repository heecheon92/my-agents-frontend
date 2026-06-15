"use client";

import type { FormEvent } from "react";
import { Field, inputClassName } from "@/components/Field";
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
import type { Localization } from "@/utils/localization";
import type { DocumentDestination } from "../shared";

type TextSourceDialogProps = {
  content: string;
  createDocumentError: unknown;
  createDocumentIsPending: boolean;
  effectiveDocumentDestination: DocumentDestination;
  hasActiveKnowledgeBase: boolean;
  isPreparingTextSource: boolean;
  localization: Localization["admin"];
  onContentChange: (content: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (title: string) => void;
  open: boolean;
  title: string;
};

export function TextSourceDialog({
  content,
  createDocumentError,
  createDocumentIsPending,
  effectiveDocumentDestination,
  hasActiveKnowledgeBase,
  isPreparingTextSource,
  localization,
  onContentChange,
  onOpenChange,
  onSubmit,
  onTitleChange,
  open,
  title,
}: TextSourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{localization.documents.textCreateTitle}</DialogTitle>
          <DialogDescription>
            {localization.documents.contentHint}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label={localization.documents.titleLabel}>
            <input
              className={inputClassName}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              required
            />
          </Field>
          <Field
            label={localization.documents.contentLabel}
            hint={localization.documents.contentHint}
          >
            <textarea
              className={`${inputClassName} min-h-48`}
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
            />
          </Field>
          {effectiveDocumentDestination !== "team" && createDocumentError ? (
            <ErrorState error={createDocumentError} />
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {localization.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={
                isPreparingTextSource ||
                (effectiveDocumentDestination !== "team" &&
                  createDocumentIsPending) ||
                !title.trim() ||
                !hasActiveKnowledgeBase
              }
            >
              {isPreparingTextSource
                ? localization.documents.ingestionLoading
                : localization.documents.createButton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
