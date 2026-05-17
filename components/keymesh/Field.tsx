import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-2 text-sm font-medium text-slate-700", className)}
    >
      <span>{label}</span>
      {children}
      {hint ? (
        <span className="text-xs font-normal text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
}

export const inputClassName =
  "min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";
