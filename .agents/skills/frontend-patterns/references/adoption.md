# Pattern and utility adoption

## When to use

Use when proposing a shared utility, component, behavior, or implementation
pattern for shared project code. Also use when adapting an existing
implementation into a new project.

## Do not use

Do not treat a directory name such as `utils/` or repeated source code as proof
that every exported function is reusable. Do not migrate product pages,
composites, or entire helper directories merely to make projects look alike.

## Required product decisions

Before adoption, identify which choices remain owned by a project:

- Data shapes, endpoints, error contracts, authorization, and tenant boundaries.
- Search matching, ordering, pagination, filter defaults, and selection scope.
- Date-only versus instant semantics, timezone, locale, currency, and units.
- Validation rules, whitespace handling, identifier restrictions, and limits.
- Whether a write is optimistic, reversible, versioned, or approval-dependent.
- Layout/branding requirements and whether a component's structure represents a
  real shared interaction or merely similar-looking screens.

If these cannot be separated without making an empty abstraction, retain the
code in its product and describe the useful technique in a reference instead.

## Stable guarantees

- A baseline abstraction has an explicit contract, a concrete reuse rationale,
  and clear client/server boundaries. Dependencies are declared and justified.
- Multiple proven consumers across existing products can justify inclusion;
  a project need not fabricate a consumer solely to justify useful shared code.
- Existing names and signatures are valuable when semantics are sound. Do not
  create compatibility aliases for defects or copy incorrect behavior unchanged.
- Prefer native JavaScript, React, browser APIs, and installed libraries when a
  wrapper adds neither a shared contract nor meaningful ergonomics.
- Pure functions, stateful hooks, service adapters, and product policies are
  different layers. Do not hide them in one expanding `common.ts` or barrel.
- Share utilities by symbol and primitives by direct module import. Do not
  assume a whole source file has the same portability as one useful export.

## Worked examples

These are adoption decisions, not instructions to install additional helpers.

### Range generation: plausible baseline utility

The references' `makeIntRange(min, max)` creates an inclusive integer range.
That can be useful across pagination controls and repeated placeholders. Before
promoting it, decide whether negative bounds are allowed, what reversed bounds
mean, and how invalid/non-integer or excessively large ranges are handled.
Keep the familiar API if those choices are already consistent across consumers.
Do not add random-number generation merely because it shares `number.ts`.

### Date display: shared technique, explicit policy

Centralizing date display may be useful, but a formatter that silently assumes
server-local timezone or displays `"-"` for all invalid values has made product
choices. Use [Dates and times](date-time.md) to establish input semantics,
timezone, and absent/invalid behavior before extracting a shared formatter.
If `date-fns` is already installed and appropriate, use its narrow imports;
a second general date library is not implied.

### Native submission: fix the technique, not the whole form stack

A helper that dispatches `new Event("submit")` is not equivalent to the browser's
`form.requestSubmit()`: native constraint validation and submitter behavior
matter. Use the native method where programmatic submission is needed, and
preserve ordinary `<form onSubmit>` / Enter behavior. Do not carry a wrapper
that obscures the distinction solely to keep an old name.

### Detail sheet: reusable behavior, conditional freshness

Opening immediately, retaining a title/close control, and placing loading/error
states in the body are reusable guarantees. Requiring a new authoritative
snapshot before an existing record can be edited is a conditional editing
contract. A read-only reference view can display retained data while refreshing;
a create form may have no existing-record read at all. See
[Detail reads](detail-reads.md) and [Mutations](mutations.md).

### API parser or upload adapter: product integration

Product-specific API envelopes, cookie names, domain formatting/masks, and upload
endpoints are not generic utility contracts. Preserve a proven implementation
technique, but connect it to the new project's actual API. Do not manufacture a
universal service layer before its boundary is known.

## Alternatives and promotion checklist

Choose exactly the level justified by the evidence:

1. **Executable baseline:** portable, repeatedly useful behavior with a clear
   contract, reasonable dependency cost, and meaningful boundary verification.
2. **Conditional playbook:** a recurring technique whose product choices vary.
   Include a complete example, integration requirements, alternatives, and
   observable verification. Do not add a runtime component just for the example.
3. **Product-local implementation:** a business decision or integration whose
   semantics should not spread to every project.
4. **Do not retain:** obsolete code, accidental duplication, trivial wrappers
   without value, or behavior that cannot be explained and verified.

Record the reason for a baseline promotion in its review: source consumers,
portable contract, discarded product assumptions, dependency impact, and edge
cases. This is a review checklist, not a requirement to add bookkeeping files or
an internal package for every helper.

## Verification

For a proposed utility, check valid boundaries, invalid inputs, mutation of
arguments, locale/timezone assumptions, and browser/server differences as
applicable. Keep regression tests for plausible failures, not tautological
copies of implementation. For a component/pattern, verify the actual interaction
and failure path using the owning feature's geometry and data contract.

Copied guidance does not distribute future fixes automatically. Review changes
to this personally authored, dotfiles-maintained playbook explicitly before
applying them to a project. Use the target project's existing maintenance process;
no particular CLI or lockfile is required. Do not present a local helper or this
playbook as a centrally updated shared package.
