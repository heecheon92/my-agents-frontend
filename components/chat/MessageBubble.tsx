import type { ReactNode } from "react";
import { AgentMessageRenderer } from "@/components/AgentMessageRenderer";
import { cn } from "@/lib/utils";

export function MessageBubble({
  roleLabel,
  content,
  isAssistant,
  align = "left",
  children,
}: {
  roleLabel: string;
  content: string;
  isAssistant: boolean;
  align?: "left" | "right";
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "max-w-[92%] overflow-hidden rounded-2xl border px-4 py-3 text-sm leading-6 sm:max-w-[78%]",
        align === "right"
          ? "ml-auto border-cal-primary bg-cal-primary text-white"
          : "border-cal-hairline bg-cal-surface-soft text-cal-ink",
      )}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] opacity-60">
        {roleLabel}
      </p>
      {content ? (
        isAssistant ? (
          <AgentMessageRenderer content={content} />
        ) : (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        )
      ) : null}
      {children}
    </div>
  );
}
