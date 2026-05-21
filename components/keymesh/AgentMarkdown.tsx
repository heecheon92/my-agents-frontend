import ReactMarkdown from "react-markdown";

function safeExternalHref(href: string | undefined) {
  if (!href) return undefined;
  try {
    const url = new URL(href, "https://example.invalid");
    if (["http:", "https:", "mailto:"].includes(url.protocol)) return href;
  } catch {
    return undefined;
  }
  return undefined;
}

export function AgentMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h3 className="mt-2 mb-1 break-words text-base font-semibold leading-6 text-cal-ink first:mt-0">
            {children}
          </h3>
        ),
        h2: ({ children }) => (
          <h3 className="mt-2 mb-1 break-words text-base font-semibold leading-6 text-cal-ink first:mt-0">
            {children}
          </h3>
        ),
        h3: ({ children }) => (
          <h4 className="mt-2 mb-1 break-words text-sm font-semibold leading-6 text-cal-ink first:mt-0">
            {children}
          </h4>
        ),
        h4: ({ children }) => (
          <h4 className="mt-2 mb-1 break-words text-sm font-semibold leading-6 text-cal-ink first:mt-0">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="my-1 whitespace-pre-wrap break-words first:mt-0 last:mb-0">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-cal-ink">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="break-words pl-1">{children}</li>,
        pre: ({ children }) => (
          <pre className="my-2 max-w-full overflow-x-auto rounded-lg border border-cal-hairline bg-cal-canvas p-3 text-xs leading-5 text-cal-body first:mt-0 last:mb-0">
            {children}
          </pre>
        ),
        code: ({ children, className }) => (
          <code
            className={
              className ??
              "rounded border border-cal-hairline bg-cal-canvas px-1 py-0.5 text-[0.92em] text-cal-ink"
            }
          >
            {children}
          </code>
        ),
        a: ({ href, children }) => {
          const safeHref = safeExternalHref(href);
          if (!safeHref) return <span>{children}</span>;
          return (
            <a
              className="font-medium text-cal-ink underline underline-offset-4"
              href={safeHref}
              target="_blank"
              rel="noreferrer noopener"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
