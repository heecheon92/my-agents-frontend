import { acceptsMermaid } from "./mermaid-policy";

let queue: Promise<unknown> = Promise.resolve();

/** Serialize the vendor's global configuration and off-screen layout work. */
export function renderMermaid(
  source: string,
  id: string,
  isCurrent: () => boolean,
) {
  const task = queue.then(async () => {
    if (!isCurrent() || !acceptsMermaid(source))
      throw new Error("Diagram unavailable");
    const { default: mermaid } = await import("mermaid");
    if (!isCurrent()) throw new Error("Stale diagram");
    const style = getComputedStyle(document.documentElement);
    const ink = style.getPropertyValue("--km-ink").trim();
    const surface = style.getPropertyValue("--km-surface").trim();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
      htmlLabels: false,
      maxTextSize: 10_000,
      maxEdges: 200,
      theme: "base",
      themeVariables: {
        darkMode: document.documentElement.classList.contains("dark"),
        background: surface,
        primaryColor: surface,
        primaryTextColor: ink,
        primaryBorderColor: ink,
        secondaryColor: surface,
        tertiaryColor: surface,
        lineColor: ink,
        textColor: ink,
        actorTextColor: ink,
        actorBkg: surface,
        actorBorder: ink,
        signalColor: ink,
        signalTextColor: ink,
        labelBoxBkgColor: surface,
        labelTextColor: ink,
        edgeLabelBackground: surface,
        fontFamily: "sans-serif",
        fontSize: "16px",
      },
    });
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-20000px;top:0;visibility:hidden;width:1200px";
    host.setAttribute("aria-hidden", "true");
    document.body.append(host);
    try {
      const { svg } = await mermaid.render(id, source, host);
      if (!isCurrent() || svg.length > 2_000_000)
        throw new Error("Diagram too large");
      const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
      if (
        parsed.querySelector(
          "parsererror, script, foreignObject, a, image, use, animate, set",
        )
      ) {
        throw new Error("Unsupported diagram output");
      }
      for (const element of parsed.querySelectorAll("*")) {
        for (const attr of element.attributes) {
          if (/^on/i.test(attr.name) || /href$/i.test(attr.name))
            throw new Error("Active diagram output");
        }
      }
      if (/@import|url\(\s*["']?(?!#)[^)]/i.test(svg))
        throw new Error("External diagram resource");
      const box = parsed.documentElement
        .getAttribute("viewBox")
        ?.split(/[ ,]+/)
        .map(Number);
      if (
        !box ||
        box.length !== 4 ||
        !box.every(Number.isFinite) ||
        box[2] <= 0 ||
        box[3] <= 0 ||
        box[2] > 12000 ||
        box[3] > 12000
      ) {
        throw new Error("Invalid diagram dimensions");
      }
      return { svg, width: box[2], height: box[3] };
    } finally {
      host.remove();
    }
  });
  queue = task.catch(() => undefined);
  return task;
}
