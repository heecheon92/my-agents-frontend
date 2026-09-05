import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentMarkdown } from "@/components/AgentMarkdown";
import { AgentMessageRenderer } from "@/components/AgentMessageRenderer";
import { LocalizationProvider } from "@/providers/localization";

const content = "Before\n\n```mermaid\nflowchart TD\nA-->B\n```\n\nAfter";
describe("assistant diagram dispatch", () => {
  it("keeps streamed diagrams as source until settled", () => {
    const html = renderToStaticMarkup(
      <AgentMessageRenderer content={content} isStreaming />,
    );
    expect(html).toContain("language-mermaid");
    expect(html).not.toContain("<figure");
  });
  it("replaces the pre wrapper only for settled assistant diagrams", () => {
    const html = renderToStaticMarkup(
      <LocalizationProvider>
        <AgentMessageRenderer content={content} />
      </LocalizationProvider>,
    );
    expect(html).toContain("<figure");
    expect(html).not.toMatch(/<pre[^>]*><figure/);
    expect(html).toContain("Before");
    expect(html).toContain("After");
  });
  it("leaves previews and ordinary code unchanged", () => {
    expect(
      renderToStaticMarkup(<AgentMarkdown content={content} />),
    ).not.toContain("<figure");
    expect(
      renderToStaticMarkup(
        <AgentMessageRenderer content={"```python\nprint(1)\n```"} />,
      ),
    ).toContain("language-python");
  });
});
