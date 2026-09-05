"use client";

import { useEffect, useId, useState } from "react";
import { useResolvedTheme } from "@/hooks/use-theme";
import { useLocalization } from "@/hooks/useLocalization";
import { renderMermaid } from "./mermaid-engine";

export function MermaidDiagram({ source }: { source: string }) {
  const { localization } = useLocalization((s) => s.localization.chat.diagram);
  const theme = useResolvedTheme();
  const id = `diagram-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [result, setResult] = useState<{
    source: string;
    theme: string;
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const key = `${theme}:${source}`;

  useEffect(() => {
    let current = true;
    let url: string | undefined;
    const timer = setTimeout(() => {
      current = false;
      setFailure(key);
    }, 8000);
    renderMermaid(source, id, () => current)
      .then((rendered) => {
        if (!current) return;
        clearTimeout(timer);
        url = URL.createObjectURL(
          new Blob([rendered.svg], { type: "image/svg+xml" }),
        );
        setResult({
          source,
          theme,
          url,
          width: rendered.width,
          height: rendered.height,
        });
      })
      .catch(() => {
        if (current) setFailure(key);
        clearTimeout(timer);
      });
    return () => {
      current = false;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, theme, id, key]);

  const ready =
    result?.source === source && result.theme === theme ? result : null;
  const failed = failure === key;
  return (
    <figure
      className="my-2 min-w-0 max-w-full rounded-lg border border-cal-hairline bg-cal-canvas p-3"
      aria-label={localization.label}
      data-testid="mermaid-diagram"
      data-theme={theme}
    >
      {ready ? (
        <section
          className="max-w-full overflow-x-auto"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable diagram must support keyboard scrolling
          tabIndex={0}
          aria-label={localization.label}
        >
          {/* SVG is an inert image, never active DOM. The source remains available below. */}
          {/* biome-ignore lint/performance/noImgElement: ephemeral local SVG blob, not a remotely optimized asset */}
          <img
            src={ready.url}
            alt={localization.label}
            width={ready.width}
            height={ready.height}
            style={{ minWidth: Math.min(ready.width, 480) }}
            className="mx-auto h-auto max-w-full"
          />
        </section>
      ) : (
        <output className="text-sm text-cal-muted">
          {failed ? localization.error : localization.loading}
        </output>
      )}
      <details className="mt-2">
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
