"use client";

import { ChevronDownIcon, LibraryBigIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  KnowledgeScopeFields,
  type KnowledgeScopeFieldsProps,
  knowledgeSourceSummary,
} from "./KnowledgeSourceSelector";

/**
 * Source scope, as a compact control inside the composer.
 *
 * It used to be an always-expanded `<details>` in the panel header with no
 * responsive rules at all — the same ~100px of chrome at 390px as at 1920px,
 * which on a phone left the transcript shorter than a single answer. Collapsing
 * it to a trigger reclaims that height at every width, and puts the scope next
 * to the input it actually governs.
 */
export function KnowledgeScopePicker({
  disabled,
  ...fields
}: KnowledgeScopeFieldsProps & { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  // Returns false until the first effect. Harmless: nothing renders until the
  // user opens the picker, by which point the real value has landed.
  const isMobile = useIsMobile();
  const {
    localization,
    knowledgeBaseMode,
    knowledgeBases,
    selectedKnowledgeBaseIds,
    requiresKnowledgeBaseSelection,
  } = fields;

  const summary = knowledgeSourceSummary({
    localization,
    knowledgeBaseMode,
    knowledgeBases,
    selectedKnowledgeBaseIds,
  });

  const trigger = (
    <Button
      // `type="button"` is load-bearing: this sits inside the composer's form,
      // and the default `submit` would send the draft on every open.
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-invalid={requiresKnowledgeBaseSelection || undefined}
      aria-label={`${localization.knowledgeSourceTitle}: ${summary}`}
      title={localization.changeSourcesAction}
      className={cn(
        "gap-1.5",
        requiresKnowledgeBaseSelection && "border-cal-error text-cal-error",
      )}
    >
      <LibraryBigIcon aria-hidden="true" />
      {/* The summary is the label, so the current scope is readable without
          opening anything — that is the whole point of collapsing it. */}
      <span className="truncate">{summary}</span>
      <ChevronDownIcon aria-hidden="true" />
    </Button>
  );

  const body = <KnowledgeScopeFields {...fields} />;

  return (
    <>
      {trigger}
      {isMobile ? (
        <Drawer direction="bottom" open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85dvh] bg-km-surface">
            <DrawerHeader className="text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
              <DrawerTitle>{localization.knowledgeSourceTitle}</DrawerTitle>
              <DrawerDescription>
                {localization.knowledgeSourceDescription}
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">{body}</div>
            <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              {/* vaul, so `asChild` — not the Base UI `render` prop the rest
                  of the chat overlays use. */}
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  {localization.closeAction}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{localization.knowledgeSourceTitle}</DialogTitle>
              <DialogDescription>
                {localization.knowledgeSourceDescription}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60dvh] overflow-y-auto">{body}</div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {localization.closeAction}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
