import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentMarkdown } from "@/components/AgentMarkdown";
import { AgentMessageRenderer } from "@/components/AgentMessageRenderer";
import { acceptsSvgSource } from "@/components/ui/svg-policy";
import { LocalizationProvider } from "@/providers/localization";

const source =
  '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>';
const content = `Before\n\n\`\`\`svg\n${source}\n\`\`\`\n\nAfter`;

describe("SVG answer dispatch", () => {
  it("renders a preview boundary only after streaming finishes", () => {
    const streaming = renderToStaticMarkup(
      <AgentMessageRenderer content={content} isStreaming />,
    );
    expect(streaming).toContain("language-svg");
    expect(streaming).not.toContain("<figure");
    const settled = renderToStaticMarkup(
      <LocalizationProvider>
        <AgentMessageRenderer content={content} />
      </LocalizationProvider>,
    );
    expect(settled).toContain('data-testid="svg-diagram"');
    expect(settled).not.toMatch(/<pre[^>]*><figure/);
    expect(settled).toContain("Before");
    expect(settled).toContain("After");
    expect(settled).not.toContain("<circle");
  });
  it("keeps previews, ordinary code, and raw HTML out of SVG dispatch", () => {
    expect(
      renderToStaticMarkup(<AgentMarkdown content={content} />),
    ).not.toContain("<figure");
    expect(
      renderToStaticMarkup(<AgentMessageRenderer content={source} />),
    ).not.toContain("<svg");
    expect(
      renderToStaticMarkup(
        <AgentMessageRenderer content={`\`\`\`xml\n${source}\n\`\`\``} />,
      ),
    ).toContain("language-xml");
  });
  it.each([
    "",
    "x".repeat(100001),
    '<?xml-stylesheet href="https://example.invalid/x"?>',
    '<!DOCTYPE svg [<!ENTITY x "boom">]><svg/>',
  ])("rejects oversized/declarative input before parsing", (input) =>
    expect(acceptsSvgSource(input)).toBe(false),
  );
});
