"use client";

import type { ComponentProps } from "react";
import { SourceActionsDialog } from "../SourceActionsDialog";
import { CreateSourceSpaceDialog } from "./CreateSourceSpaceDialog";
import { SourceSpaceBrowserSheet } from "./SourceSpaceBrowserSheet";
import { TextSourceDialog } from "./TextSourceDialog";
import { UploadDialog } from "./UploadDialog";

type SourcesSurfaceOverlaysProps = {
  sourceActions: ComponentProps<typeof SourceActionsDialog>;
  browserSheet: ComponentProps<typeof SourceSpaceBrowserSheet>;
  createSourceSpaceDialog: ComponentProps<typeof CreateSourceSpaceDialog>;
  textSourceDialog: ComponentProps<typeof TextSourceDialog>;
  uploadDialog: ComponentProps<typeof UploadDialog>;
};

export function SourcesSurfaceOverlays({
  sourceActions,
  browserSheet,
  createSourceSpaceDialog,
  textSourceDialog,
  uploadDialog,
}: SourcesSurfaceOverlaysProps) {
  return (
    <>
      <SourceActionsDialog {...sourceActions} />
      <SourceSpaceBrowserSheet {...browserSheet} />
      <CreateSourceSpaceDialog {...createSourceSpaceDialog} />
      <TextSourceDialog {...textSourceDialog} />
      <UploadDialog {...uploadDialog} />
    </>
  );
}
