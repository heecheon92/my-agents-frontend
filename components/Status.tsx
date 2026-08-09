import { cn } from "@/lib/utils";
import { resolveErrorMessage } from "@/utils/error-message";
import { defaultLocalization, type Localization } from "@/utils/localization";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-km-hairline bg-km-surface-muted p-6 text-center">
      <p className="font-semibold text-km-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-km-muted">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = defaultLocalization.status.defaultErrorTitle,
  error,
  description,
  localization = defaultLocalization,
}: {
  title?: string;
  /** A thrown value. Its message is never rendered directly — see `resolveErrorMessage`. */
  error?: unknown;
  /**
   * Already-localized copy for failures the UI detects itself, such as form
   * validation. Use this instead of wrapping a message in `new Error(...)`:
   * `error` is treated as untrusted and deliberately collapsed to generic copy.
   */
  description?: string;
  /**
   * Optional because `LocalizationProvider` is currently hardcoded to `ko` and
   * `defaultLocalization` *is* the Korean dictionary, so the fallback is
   * correct at runtime. Threading it explicitly from the 28 call sites is left
   * for whenever locale switching becomes real.
   */
  localization?: Localization;
}) {
  const message = description ?? resolveErrorMessage(error, localization);
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
        "inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-semibold",
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
