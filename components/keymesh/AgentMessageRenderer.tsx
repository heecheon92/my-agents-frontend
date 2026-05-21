import { AgentMarkdown } from "./AgentMarkdown";

export type AgentArtifact =
  | { type: "chart"; spec: unknown; caption?: string }
  | { type: "graph"; spec: unknown; caption?: string }
  | {
      type: "diagram";
      source: string;
      format: "mermaid" | "svg";
      caption?: string;
    }
  | { type: "table"; columns: string[]; rows: unknown[][]; caption?: string }
  | {
      type: "tool_result";
      toolName: string;
      result: unknown;
      caption?: string;
    };

export function AgentMessageRenderer({
  content,
  artifacts = [],
}: {
  content: string;
  artifacts?: AgentArtifact[];
}) {
  return (
    <div className="grid gap-2">
      <AgentMarkdown content={content} />
      {artifacts.length > 0 ? (
        <div className="grid gap-2" data-testid="agent-artifact-boundary">
          {artifacts.map((artifact, index) => (
            <div
              key={`${artifact.type}-${index}`}
              className="rounded-lg border border-dashed border-cal-hairline bg-cal-canvas p-3 text-xs text-cal-muted"
            >
              {artifact.caption ?? `${artifact.type} artifact pending renderer`}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
