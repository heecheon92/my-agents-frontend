# Mermaid in assistant answers

Assistant Markdown opts into diagrams through MessageBubble → AgentMessageRenderer →
AgentMarkdown. Streaming and replay propagate isStreaming: fences remain code until output settles.
Shared source previews and publication review do not opt in. Existing Markdown copy remains source.

The pre override replaces only language-mermaid blocks with components/ui/mermaid-diagram.tsx.
It never nests a figure in pre/code. The vendor is isolated behind components/ui/mermaid-engine.ts.
Mermaid 11.17.2 is dynamically imported on demand; plain answers do not request the library.
Supported families are flowchart/graph, sequenceDiagram, stateDiagram/stateDiagram-v2, erDiagram,
and classDiagram. Other families fall back to source.

## Safety and lifecycle

Source is untrusted. Site configuration is strict, with HTML labels and click binding disabled.
Directives/frontmatter, click and styling instructions, markup and external URLs are rejected.
This deliberately rejects some otherwise valid Mermaid syntax rather than silently rewriting it.
The final SVG is checked for active elements, href/event attributes and external CSS resources,
then displayed via an img blob URL. It is never inserted into application DOM as HTML.
Markdown itself still does not allow raw HTML. Do not replace the img with inline SVG injection.

Input is limited to 10,000 characters and 200 edges; output to 2 MB and 12,000 units per dimension.
A serial queue protects Mermaid's global configuration and temporary off-screen layout container.
Stale work is discarded on theme/source changes and unmount; temporary nodes and blob URLs are
cleaned up. No diagram cache or user content is persisted. An eight-second deadline selects the
source fallback, but cannot preempt synchronous main-thread parsing/layout. Input bounds remain
the protection against that limitation.

Images use the existing theme's ink/surface tokens, with 16px diagram text. Local scrolling keeps
wide diagrams legible within the message; source disclosure is keyboard accessible. There are no
animations or new overlay/zoom controls. Source is retained during errors and for assistive use.
Generated images are model explanations, not verified evidence.

## Dependency decision and verification

Hand-written layout cannot reasonably cover five graph grammars. Both Mermaid and Mermaid Tiny
11.17.2 are MIT licensed. Tiny's published package is 2.56 MB unpacked and declares no dependencies,
but its browser-global bundle failed when imported through this Next.js module build. The standard
package's ESM API passed actual browser rendering and provides diagram-level lazy loading.
Full package size is 84 MB unpacked (includes multiple distributions); installation added 111
packages. These are install sizes, not initial browser transfer sizes.

Baseline production JavaScript across all chunks: 2,831,087 bytes. Initial implementation build:
6,683,075 bytes across all chunks, including deferred Mermaid diagram families. This total is not
the initial route payload. Browser checks must verify diagram-free requests separately.

Tests: tests/mermaid-policy.test.ts, tests/mermaid-dispatch.test.tsx, e2e/mermaid.spec.ts.
Use the real library for browser checks: valid families, malformed/active source, images loading,
theme, widths 390/768/1280, reload and replay. No backend or paid provider is required.

Verification on 2026-09-05: lint/typecheck/build passed and 365 unit/component tests passed.
The full production browser suite had 190 passes, 2 environment-gated skips, and one file-drop
overlay failure; that unchanged test passed twice in isolation. The final focused Mermaid suite
passed all 3 scenarios after the stable block-component refinement. Its new-browser navigation to
five diagrams took 760 ms on a warm local production server (not an SLA or isolated render metric).
Screenshots were inspected at desktop and 390px; tests also cover 768px, clipboard Markdown,
keyboard source disclosure, reduced motion, print visibility and browser page errors.
Normal streaming is tested through run_completed. The current replay UI calls the synchronous
endpoint; no streaming-replay transport was introduced. Screen-reader behavior beyond semantic
markup and adversarial CPU stress testing remain unverified.

References: [Mermaid usage](https://mermaid.js.org/config/usage.html),
[Mermaid configuration](https://mermaid.js.org/config/schema-docs/config.html).
