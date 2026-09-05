export const MAX_DIAGRAM_CHARS = 10_000;

/** A deliberately small diagram language surface, with site-owned styling. */
export function acceptsMermaid(source: string): boolean {
  return (
    source.length <= MAX_DIAGRAM_CHARS &&
    /^(?:flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|erDiagram|classDiagram)\b/.test(
      source.trimStart(),
    ) &&
    !/%%\s*\{|^\s*---|\b(?:click|classDef|linkStyle|style)\b|<\/?[a-z]|(?:https?:|javascript:|data:|url\s*\()/im.test(
      source,
    )
  );
}
