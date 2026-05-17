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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
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
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "slate" && "bg-slate-100 text-slate-700",
        tone === "green" && "bg-emerald-100 text-emerald-700",
        tone === "blue" && "bg-blue-100 text-blue-700",
        tone === "amber" && "bg-amber-100 text-amber-700",
        tone === "rose" && "bg-rose-100 text-rose-700",
      )}
    >
      {children}
    </span>
  );
}
