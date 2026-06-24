"use client";

import type { ComponentProps } from "react";
import { SourceActionsDialog } from "../SourceActionsDialog";
import { CreateSourceSpaceDialog } from "./CreateSourceSpaceDialog";
import { SourceSpaceBrowserSheet } from "./SourceSpaceBrowserSheet";
import {
  SourceSpaceDeleteDialog,
  SourceSpaceRenameDialog,
  SourceSpaceShareDialog,
} from "./SourceSpaceLifecycleDialogs";
import { TextSourceDialog } from "./TextSourceDialog";
import { UploadDialog } from "./UploadDialog";

type SourcesSurfaceOverlaysProps = {
  sourceActions: ComponentProps<typeof SourceActionsDialog>;
  sourceSpaceLifecycle: {
    activeSourceSpace: ComponentProps<
      typeof SourceSpaceRenameDialog
    >["sourceSpace"];
    deleteKnowledgeBase: ComponentProps<
      typeof SourceSpaceDeleteDialog
    >["mutation"];
    groups: ComponentProps<typeof SourceSpaceShareDialog>["groups"];
    localization: ComponentProps<
      typeof SourceSpaceRenameDialog
    >["localization"];
    onDelete: ComponentProps<typeof SourceSpaceDeleteDialog>["onDelete"];
    onOpenChange: (
      open: boolean,
      dialog: "rename" | "delete" | "share",
    ) => void;
    onRename: ComponentProps<typeof SourceSpaceRenameDialog>["onRename"];
    openDialog?: "rename" | "delete" | "share";
    updateKnowledgeBase: ComponentProps<
      typeof SourceSpaceRenameDialog
    >["mutation"];
  };
  browserSheet: ComponentProps<typeof SourceSpaceBrowserSheet>;
  createSourceSpaceDialog: ComponentProps<typeof CreateSourceSpaceDialog>;
  textSourceDialog: ComponentProps<typeof TextSourceDialog>;
  uploadDialog: ComponentProps<typeof UploadDialog>;
};

export function SourcesSurfaceOverlays({
  sourceActions,
  sourceSpaceLifecycle,
  browserSheet,
  createSourceSpaceDialog,
  textSourceDialog,
  uploadDialog,
}: SourcesSurfaceOverlaysProps) {
  return (
    <>
      <SourceActionsDialog {...sourceActions} />
      <SourceSpaceRenameDialog
        localization={sourceSpaceLifecycle.localization}
        mutation={sourceSpaceLifecycle.updateKnowledgeBase}
        onOpenChange={(open) =>
          sourceSpaceLifecycle.onOpenChange(open, "rename")
        }
        onRename={sourceSpaceLifecycle.onRename}
        open={sourceSpaceLifecycle.openDialog === "rename"}
        sourceSpace={sourceSpaceLifecycle.activeSourceSpace}
      />
      <SourceSpaceDeleteDialog
        localization={sourceSpaceLifecycle.localization}
        mutation={sourceSpaceLifecycle.deleteKnowledgeBase}
        onDelete={sourceSpaceLifecycle.onDelete}
        onOpenChange={(open) =>
          sourceSpaceLifecycle.onOpenChange(open, "delete")
        }
        open={sourceSpaceLifecycle.openDialog === "delete"}
        sourceSpace={sourceSpaceLifecycle.activeSourceSpace}
      />
      <SourceSpaceShareDialog
        groups={sourceSpaceLifecycle.groups}
        localization={sourceSpaceLifecycle.localization}
        onOpenChange={(open) =>
          sourceSpaceLifecycle.onOpenChange(open, "share")
        }
        open={sourceSpaceLifecycle.openDialog === "share"}
        sourceSpace={sourceSpaceLifecycle.activeSourceSpace}
      />
      <SourceSpaceBrowserSheet {...browserSheet} />
      <CreateSourceSpaceDialog {...createSourceSpaceDialog} />
      <TextSourceDialog {...textSourceDialog} />
      <UploadDialog {...uploadDialog} />
    </>
  );
}
