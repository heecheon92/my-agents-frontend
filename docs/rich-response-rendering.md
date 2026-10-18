# Rich assistant responses and future UI adapters

## Current implementation

Assistant Markdown is persisted text. Completed `mermaid` and `svg` code fences dispatch through
`components/ui/agent-diagram.tsx`, the application-owned typed diagram catalog. `DiagramContent`
contains only `format` and `source`; renderers do not know about HTTP, SSE, run IDs, or model providers.
The existing `AgentArtifact` diagram variant shares its `DiagramFormat` type. Its separate structured
artifact display is still a placeholder, not a served backend contract or implemented A2UI surface.

While an answer streams, both languages remain code. Source previews do not opt into diagrams.
Answer copy and refresh use the original Markdown. A renderer failure affects only its own figure.
Mermaid remains lazy-loaded with its existing policy; see [Mermaid rendering](./mermaid-rendering.md).
No package or backend/API model was added for SVG.

## Static SVG boundary

`svg-policy.ts` parses XML in a detached document, validates a closed set of elements and attributes,
and rebuilds accepted content in the SVG namespace. Only the resulting serialized document becomes
an `image/svg+xml` blob for an `img`; model markup is never inserted into the application DOM.
Missing root namespaces are normalized. A valid `viewBox` or explicit bounded width/height is required.

Supported content includes shapes/paths, text, groups, gradients, markers, masks, clipping, and
allowlisted presentation attributes or inline presentation styles. Local paint/marker/clip/mask
references must point to permitted elements. Resource nesting cannot recursively invoke another
marker, clip, or mask. Duplicate IDs and missing references are rejected.

Scripts, event handlers, external resources/URLs, images, links, embedded HTML, `use`, animation,
filters, style blocks, CSS imports/escapes/indirection, XML declarations/processing instructions,
DTDs, entities, and foreign namespaces fall back to source. This is a supported static subset,
not a general SVG editor or general-purpose sanitizer. Original source is retained unchanged.

Limits are 100,000 input characters, 1,000 elements, depth 32, and a 12,000-unit maximum per
viewBox coordinate/dimension. Native parsing/layout is synchronous, so these bounds are the
resource guard; there is no claim of preempting arbitrary browser work. Browser image-context
restrictions are additional defense, not a replacement for validation
([MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)).

A title supplies image alternative text when available; otherwise the localized SVG label is used.
Source disclosure remains keyboard accessible and opens on errors. Authors should also explain the
image in surrounding text. Generated images are explanations, not independent proof of their claims.
Blob URLs are released when their source changes or the component unmounts. The artwork canvas
remains white in both themes to preserve authored colors/default black fill; application chrome
retains theme tokens. The image is bounded to 70dvh. Wide artwork retains a 480px minimum
reading width (or its smaller intrinsic width), with keyboard-accessible local horizontal scrolling
on narrow messages instead of shrinking labels to unreadable sizes.

## AG-UI and A2UI direction

This follows the existing backend architecture decisions, read as context rather than new API models:

- `../my-agents/docs/product-chat-service/30-rich-response-rendering-and-agent-ui-boundaries.md`
- `../my-agents/docs/product-chat-service/27-agent-frontend-interaction-contract.md`

[AG-UI](https://docs.ag-ui.com/introduction) standardizes agent/application events and interaction.
[A2UI](https://a2ui.org/introduction/what-is-a2ui/) describes generated surfaces rendered from an
application-supported component catalog. These layers can work together; neither requires us to
replace FastAPI/LangGraph with the Vercel AI SDK. A2UI is transport-agnostic, so adopting a UI catalog
and adopting AG-UI transport can be separate milestones.

| Layer | Current owner | Future integration seam |
| --- | --- | --- |
| Transcript, run lifecycle, permissions, durable interactions | Product DB and backend semantic contracts | Remain authoritative |
| Event delivery | Existing REST/SSE client | AG-UI adapter with run/resume/cancel/replay parity |
| UI payload validation | Markdown language dispatch and renderer-specific validation | Versioned A2UI catalog/prop/binding/action validation |
| Presentation | Typed `AgentDiagram` plus maintained local components | A2UI adapter dispatches to the same renderers |
| Fallback/export | Original Markdown and source disclosures | Retain text alternatives for unsupported catalogs/clients |

A later catalog can add comparison tables, steps/timelines, facts with citations, charts, and artifact
previews. Prefer a small read-only slice first: a document comparison surface using existing source
references and a text fallback. Charts need validated data, not just model-authored pixels. Controls
that change data must map to typed authorized backend actions; arbitrary HTML/JavaScript/event
handlers never become a catalog extension mechanism.

Do not label the local registry A2UI-compatible yet. No AG-UI/A2UI library, wire schema, adapter,
surface persistence, or action bridge is implemented in this change. Before that milestone, select
a protocol version, serve the backend contract through OpenAPI, define the supported catalog,
and verify reload, unknown-component fallback, cancellation, resume, authorization, and accessibility.

Official references and examples:

- [AG-UI overview and Dojo](https://docs.ag-ui.com/introduction#ag-ui-in-action)
- [A2UI catalogs](https://a2ui.org/concepts/catalogs/)
- [A2UI examples and SDKs](https://github.com/a2ui-project/a2ui)

## Try it in chat

Ask for SVG explicitly and request a fenced `svg` block with a `viewBox`, ordinary shapes and
presentation attributes, and no scripts, animation, external images, `foreignObject`, or style tags.
Examples:

- `RAG의 질문 → 문서 검색 → 답변 생성 과정을 SVG 다이어그램으로 설명해줘. 한글 설명과 화살표를 넣어줘.`
- `가상의 월별 독서량이 1월 2권, 2월 5권, 3월 3권, 4월 7권일 때 SVG 막대그래프로 보여줘. 각 막대에 숫자를 표시해줘.`
- `SVG로 원형 배지 안에 산과 일출을 그려줘. 하늘에는 그라데이션을 쓰고 clipPath로 풍경을 원 안에 넣어줘.`

Charts and timelines expressed this way are static images. Interactive charts, sortable tables,
math rendering, and declarative A2UI cards are not included. Rendering begins after the answer
settles; open the source disclosure to inspect or copy the original code. The owner confirmed the
SVG path during local use; automated checks are described below.

## Verification

Unit dispatch tests cover settled/streaming/source-preview boundaries and early size/declaration
rejection. `e2e/svg.spec.ts` exercises browser parsing/image decoding, supported graphics, invalid
and hostile inputs, copy, reload, keyboard source disclosure, theme, and mobile widths. Run it with
`e2e/mermaid.spec.ts` to protect the existing renderer. Final results are in the implementation log.
