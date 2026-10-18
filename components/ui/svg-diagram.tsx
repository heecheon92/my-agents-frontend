"use client";

import { useEffect, useState } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { prepareSvg } from "./svg-policy";

export function SvgDiagram({ source }: { source: string }) {
  const { localization } = useLocalization((s) => s.localization.chat.svg);
  const [result, setResult] = useState<{
    source: string;
    url: string;
    width: number;
    height: number;
    label: string;
  } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    let url: string | undefined;
    try {
      const prepared = prepareSvg(source);
      url = URL.createObjectURL(
        new Blob([prepared.svg], { type: "image/svg+xml" }),
      );
      setFailedSource(null);
      setResult({
        source,
        url,
        width: prepared.width,
        height: prepared.height,
        label: prepared.label,
      });
    } catch {
      setFailedSource(source);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);

  const failed = failedSource === source;
  const ready = result?.source === source && !failed ? result : null;
  return (
    <figure
      className="my-2 min-w-0 max-w-full rounded-lg border border-cal-hairline bg-cal-canvas p-3"
      aria-label={localization.label}
      data-testid="svg-diagram"
    >
      {ready ? (
        // The white image canvas preserves authored colors and the SVG default black fill in either UI theme.
        <section
          className="max-w-full overflow-x-auto rounded bg-km-artwork-canvas"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: wide artwork needs keyboard scrolling
          tabIndex={0}
          aria-label={ready.label || localization.label}
        >
          {/* biome-ignore lint/performance/noImgElement: validated local SVG blob, not a remote image */}
          <img
            key={ready.url}
            src={ready.url}
            alt={ready.label || localization.label}
            width={ready.width}
            height={ready.height}
            style={{ minWidth: Math.min(ready.width, 480) }}
            className="mx-auto block h-auto max-h-[70dvh] max-w-full object-contain"
            onError={() => setFailedSource(source)}
          />
        </section>
      ) : (
        <output className="text-sm text-cal-muted">
          {failed ? localization.error : localization.loading}
        </output>
      )}
      <details className="mt-2" open={failed}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm text-cal-muted focus-visible:outline-2">
          {localization.source}
        </summary>
        <pre className="max-w-full overflow-x-auto text-xs leading-5">
          <code>{source}</code>
        </pre>
      </details>
    </figure>
  );
}
