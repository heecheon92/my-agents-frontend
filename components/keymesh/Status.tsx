import { cn } from "@/lib/utils";
import { defaultLocalization } from "@/utils/localization";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-cal-hairline bg-cal-surface-soft p-6 text-center">
      <p className="font-semibold text-cal-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-cal-muted">{description}</p>
    </div>
  );
}

export function ErrorState({
  title = defaultLocalization.status.defaultErrorTitle,
  error,
}: {
  title?: string;
  error: unknown;
}) {
  const message =
    error instanceof Error
      ? error.message
      : defaultLocalization.status.defaultErrorDescription;
  return (
    <div className="rounded-lg border border-cal-error/20 bg-cal-error/5 p-4 text-sm text-cal-error">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6">{message}</p>
    </div>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "blue" | "amber" | "rose";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium",
        tone === "slate" && "bg-cal-surface-card text-cal-ink",
        tone === "green" && "bg-cal-success/10 text-cal-success",
        tone === "blue" && "bg-cal-brand-accent/10 text-cal-brand-accent",
        tone === "amber" && "bg-cal-warning/10 text-cal-warning",
        tone === "rose" && "bg-cal-error/10 text-cal-error",
      )}
    >
      {children}
    </span>
  );
}
