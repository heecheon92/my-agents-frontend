"use client";

import { UploadIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { ChatLocalization } from "../types";
import type { AttachmentComposer } from "./useAttachmentComposer";

/** Ignores text and link drags, which fire the same events. */
function carriesFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/**
 * Makes an element accept dropped files.
 *
 * A hook rather than a wrapper component so the handlers land on the
 * conversation panel itself. A wrapper would have to be either
 * `display: contents` — which has no box, so the panel's own padding would not
 * be a drop target and a synthetic event dispatched at the panel would never
 * reach it — or a second full-height box duplicating the panel's layout
 * classes. Neither is worth a component boundary.
 *
 * Convenience only, never the sole path: dragging is unreachable by keyboard
 * and invisible to a screen reader, so the composer's attach button stays the
 * accessible route and offers everything this does.
 */
export function useAttachmentDropzone({
  composer,
  disabled,
}: {
  composer: AttachmentComposer;
  disabled: boolean;
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  /*
   * `dragenter`/`dragleave` fire for every descendant the pointer crosses, so a
   * boolean alone flickers the overlay off the moment the cursor passes over a
   * message. Counting entries and exits is the standard fix: the overlay hides
   * only when the count returns to zero.
   */
  const dragDepth = useRef(0);

  const reset = useCallback(() => {
    dragDepth.current = 0;
    setIsDraggingOver(false);
  }, []);

  // Inert unless the served capability reports the feature usable — the same
  // gate the attach button uses. A panel that highlights on drag and then
  // silently discards the file would be worse than one that never reacted.
  const active = composer.available && !disabled;

  const dropzoneProps = active
    ? {
        onDragEnter(event: React.DragEvent) {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          dragDepth.current += 1;
          setIsDraggingOver(true);
        },
        onDragOver(event: React.DragEvent) {
          if (!carriesFiles(event)) return;
          // Both required. Without `preventDefault` the browser treats the
          // drop as a navigation and replaces the app with the file.
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        },
        onDragLeave(event: React.DragEvent) {
          if (!carriesFiles(event)) return;
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) reset();
        },
        onDrop(event: React.DragEvent) {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          reset();
          const files = Array.from(event.dataTransfer.files);
          if (files.length > 0) composer.addFiles(files);
        },
      }
    : {};

  return { dropzoneProps, isDraggingOver: active && isDraggingOver };
}

/**
 * The highlight shown while files hover the conversation.
 *
 * Positioned against the panel, so it covers the transcript and the composer
 * alike — the whole conversation is the target, which is what makes the
 * gesture worth having over aiming at a button.
 */
export function AttachmentDropOverlay({
  localization,
}: {
  localization: ChatLocalization;
}) {
  return (
    <div
      data-slot="attachment-drop-overlay"
      // Decorative, and deliberately not a pointer target: an element that
      // captured pointer events here would swallow the drop it is advertising.
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-cal-primary bg-cal-canvas/85 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[var(--duration-fast)]"
    >
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <UploadIcon aria-hidden="true" className="size-6 text-cal-primary" />
        <p className="text-sm font-semibold text-cal-ink">
          {localization.attachments.dropHint}
        </p>
        <p className="text-xs leading-5 text-cal-muted">
          {localization.attachments.dropHintDescription}
        </p>
      </div>
    </div>
  );
}
