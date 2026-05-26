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
    <div className="rounded-xl border border-dashed border-km-hairline bg-km-surface-muted p-6 text-center">
      <p className="font-semibold text-km-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-km-muted">{description}</p>
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
    <div className="rounded-xl border border-km-error/25 bg-km-error/8 p-4 text-sm text-km-error">
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
  tone?: "slate" | "green" | "blue" | "amber" | "rose" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-semibold",
        tone === "slate" &&
          "border-km-hairline bg-km-surface-muted text-km-ink",
        tone === "green" &&
          "border-km-success/20 bg-km-success/10 text-km-success",
        (tone === "blue" || tone === "info") &&
          "border-km-info/20 bg-km-info/10 text-km-info",
        tone === "amber" &&
          "border-km-warning/20 bg-km-warning/10 text-km-warning",
        tone === "rose" && "border-km-error/20 bg-km-error/10 text-km-error",
      )}
    >
      {children}
    </span>
  );
}
