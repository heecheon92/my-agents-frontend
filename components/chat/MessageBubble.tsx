import type { ReactNode } from "react";
import { AgentMessageRenderer } from "@/components/AgentMessageRenderer";
import { cn } from "@/lib/utils";

export function MessageBubble({
  roleLabel,
  content,
  isAssistant,
  isStreaming = false,
  align = "left",
  header,
  children,
}: {
  roleLabel: string;
  content: string;
  isAssistant: boolean;
  isStreaming?: boolean;
  align?: "left" | "right";
  /**
   * Rendered above the answer text, below the role label. The agent process
   * belongs here rather than in the footer: it describes work that happens
   * *before* the answer, and a reader watching a run needs it in a fixed place
   * that the growing answer does not push around.
   */
  header?: ReactNode;
  children?: ReactNode;
}) {
  /**
   * Only the user's turn is a bubble.
   *
   * The assistant used to get one too — `bg-cal-surface-soft` inside a
   * hairline border — which made every answer a tile floating on the panel, and
   * the longer the answer the more the container dominated it. It now sits
   * directly on the panel surface.
   *
   * The background is the surface token, not literally white: the panel is
   * `--km-surface`, which is `#ffffff` in light and `#1c1b19` in dark. Hardcoding
   * white would put a glaring card back in dark mode. Matching the token makes
   * the container invisible in both themes, which is the point.
   *
   * Padding is retained so the text keeps its current position rather than
   * jumping flush against the transcript's edge.
   *
   * `align`, not `isAssistant`, decides this: `isAssistant` is false for an
   * assistant turn that has not streamed any text yet, which would otherwise
   * flip a generating message into user styling for a frame.
   */
  const isUserBubble = align === "right";

  return (
    <div
      className={cn(
        "max-w-[92%] overflow-hidden rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[78%]",
        isUserBubble
          ? "ml-auto border border-cal-primary bg-cal-primary text-white"
          : // The width cap stays: it keeps the measure readable, which the
            // bubble was previously providing by accident.
            "bg-cal-surface-card text-cal-ink",
      )}
    >
      <p
        className={cn(
          "mb-1 text-xs font-semibold uppercase tracking-[0.08em]",
          isUserBubble ? "opacity-60" : "text-cal-muted",
        )}
      >
        {roleLabel}
      </p>
      {header ? <div className="mb-3">{header}</div> : null}
      {content ? (
        isAssistant ? (
          <AgentMessageRenderer content={content} isStreaming={isStreaming} />
        ) : (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        )
      ) : null}
      {children}
    </div>
  );
}
