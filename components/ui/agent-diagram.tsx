import { MermaidDiagram } from "./mermaid-diagram";
import { SvgDiagram } from "./svg-diagram";

/** Application-owned presentation catalog; transport adapters must validate before dispatch. */
export const DIAGRAM_FORMATS = ["mermaid", "svg"] as const;
export type DiagramFormat = (typeof DIAGRAM_FORMATS)[number];
export type DiagramContent = { format: DiagramFormat; source: string };

const renderers = { mermaid: MermaidDiagram, svg: SvgDiagram } as const;

/** Shared by Markdown dispatch and future declarative UI adapters. No event/run ownership. */
export function AgentDiagram({ format, source }: DiagramContent) {
  const Renderer = renderers[format];
  return <Renderer source={source} />;
}
