import { describe, expect, it } from "vitest";
import { acceptsMermaid } from "@/components/ui/mermaid-policy";

describe("diagram boundary", () => {
  it.each([
    "flowchart TD\nA-->B",
    "sequenceDiagram\nA->>B: Hello",
    "stateDiagram-v2\n[*]-->Ready",
    "erDiagram\nA ||--o{ B : owns",
    "classDiagram\nA <|-- B",
  ])("accepts the supported family: %s", (source) => {
    expect(acceptsMermaid(source)).toBe(true);
  });
  it.each([
    "pie\n title Test",
    "flowchart TD\nclick A href 'https://evil.invalid'",
    "%%{init: {securityLevel: 'loose'}}%%\nflowchart TD\nA-->B",
    "flowchart TD\nA[<img src=x>]",
    "flowchart TD\nclassDef red fill:red",
    `flowchart TD\n${"a".repeat(10000)}`,
  ])("rejects unsupported or active source: %s", (source) => {
    expect(acceptsMermaid(source)).toBe(false);
  });
});
