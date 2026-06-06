import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentMarkdown } from "@/components/AgentMarkdown";
import { AgentMessageRenderer } from "@/components/AgentMessageRenderer";

function renderMarkdown(content: string) {
  return renderToStaticMarkup(createElement(AgentMarkdown, { content }));
}

describe("AgentMarkdown", () => {
  it("renders assistant bold text and bullet lists as semantic markdown", () => {
    const html = renderMarkdown(
      "**1단계(필수 서류 준비)**\n- **소득공제신고서** 작성\n- 제출서류 확인",
    );

    expect(html).toContain("<strong");
    expect(html).toContain("1단계(필수 서류 준비)");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("소득공제신고서");
  });

  it("does not render raw HTML as executable nodes", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script><img src="x" onerror="alert(1)"> **safe**',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps unsafe link protocols inert", () => {
    const html = renderMarkdown(
      "[bad](javascript:alert(1)) [ok](https://example.com)",
    );

    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noreferrer noopener"');
  });
});

describe("AgentMessageRenderer", () => {
  it("provides a future artifact boundary without rendering executable specs", () => {
    const html = renderToStaticMarkup(
      createElement(AgentMessageRenderer, {
        content: "Assistant text",
        artifacts: [{ type: "chart", spec: { series: [1, 2, 3] } }],
      }),
    );

    expect(html).toContain("Assistant text");
    expect(html).toContain("agent-artifact-boundary");
    expect(html).toContain("chart artifact pending renderer");
    expect(html).not.toContain("series");
  });
});
