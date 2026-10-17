---
name: frontend-patterns
description: Implement or review a requested Next.js or React frontend feature using personal patterns for localized routing, Next.js proxy/middleware, authentication, login/logout Server Actions, session cookies and refresh, forms, lists, detail reads, mutations, dates, and file uploads, or assess a utility for shared inclusion. Use when one of these patterns is relevant to the target project and its installed stack. Do not generate features, APIs, or product rules merely because a reference exists.
---

# Personal Next.js and React frontend patterns

## Purpose and ownership

Make familiar implementation techniques easy to reuse without deciding product
behavior. This is a personally authored, dotfiles-maintained playbook. Use
`react-ui-ux` as a companion when its behavioral guidance is relevant; neither
skill requires a marketplace installation or a separate project policy file.

Keep three layers distinct:

1. **Executable baseline:** working tools, providers, semantic primitives, and
   utilities whose contracts are genuinely shared.
2. **Conditional playbook:** the references below; instantiate only the pattern
   needed by the requested feature. Examples are not starter application pages.
3. **Product decisions:** requirements supplied by the project, not inferred from
   another application or this playbook.

Repeated code across products is evidence of a candidate, not proof of a shared
requirement. Prefer familiar names and signatures when they are sound; fix
incorrect semantics rather than reproducing them for consistency.

## Before choosing a pattern

- Follow explicit user requests and applicable target-repository instructions,
  including its API, authentication, authorization, localization, and design
  rules, before applying skill examples, subject to higher-priority instructions.
  Do not assume a particular policy file or client-specific rule discovery.
- Inspect the requested feature, existing components, dictionary, query keys,
  backend contracts, and installed framework documentation. Reuse a working
  pattern already present instead of creating a second convention.
- When relevant, read `react-ui-ux` and only its applicable references for
  behavioral guarantees. Optional performance guidance may help with compatible
  optimization work, but must not replace the installed architecture or these
  behavioral contracts; no particular marketplace skill is required.
- Separate known requirements from unanswered choices. Resolve discoverable
  facts first. Ask only about material decisions that remain unknown; continue
  independent work. Do not silently invent a role, endpoint, schema, search
  rule, timezone, or mutation outcome.
- Do not activate a human-invoked interview or other workflow automatically.

## Reference routing

Read only the applicable reference; do not load the whole playbook for every
React task. Several references may apply to one feature.

- [Pattern and utility adoption](references/adoption.md): deciding what belongs
  in executable baseline code versus guidance versus a particular product.
- [Localized routing and Proxy](references/auth-routing.md): complete examples
  for locale/route classification, safe return targets, and a thin `proxy.ts`.
- [Sessions and authentication](references/auth-session.md): typed backend
  boundaries, cookie rotation, login/logout Server Actions, authorization, and
  identity transitions. Apply these examples only when the feature is requested;
  do not install an auth scaffold merely because this reference exists.
- [Forms](references/forms.md): RHF/Zod validation, native submission, and
  accessible field/save errors. A create form does not inherently need an
  existing-record fetch.
- [Lists](references/lists.md): query-owned list states, controlled filters and
  pagination, URL ownership, and retained refresh. Select a backend-supported
  pagination/search contract first.
- [Detail reads](references/detail-reads.md): immediate sheet opening and
  read-only detail loading. Retained display data is not editing authority.
- [Mutations](references/mutations.md): confirmed writes, failure recovery,
  duplicate prevention, invalidation, and conditional authoritative edit checks.
- [Dates and times](references/date-time.md): distinguish instants, date-only
  values, and durations before choosing formatters or utilities.
- [File selection and upload](references/file-upload.md): native selection,
  explicit submission, validation boundaries, and server-confirmed upload state.

## Example contract

- Examples teach techniques, not domain models. Types, component names, fields,
  schemas, and chosen pagination modes are illustrative contracts explicitly
  called out in each reference.
- Code blocks are independent examples, not files to copy as a group. Package
  imports, aliases, UI primitive APIs, and policy modules illustrate a stack,
  not dependencies guaranteed to exist in the target repository. Check installed
  React, Next.js, TanStack Query, RHF/Zod, and component versions where used; adapt
  to existing project equivalents without installing a second convention.
- Service callbacks are required integration boundaries, not working backend
  implementations. Connect them to the project's validated service layer; never
  add fake endpoints, successful no-ops, or pretend progress to make a demo work.
- Required copy props keep examples independent of a product dictionary. In a
  feature, source those strings from the approved localization dictionary; do
  not paste example labels or invent translation keys in production.
- Preserve semantic HTML, stable async regions, and accurate pending/error/
  success states. Tailor geometry to the actual feature; example dimensions are
  not an approved design system for product pages.
- Explicitly assess optimistic behavior, retention, and fresh-read requirements.
  Do not infer that every view needs a fresh fetch or that every write is safe
  to present optimistically. Server authorization remains mandatory regardless
  of client presentation or freshness checks.

## Completion

Before finishing a feature built from these references:

1. State the product choices actually used and any remaining blocker.
2. Remove example-only assumptions; use project DTOs, dictionary, and services.
3. Verify pending, empty, failure, retry, success, and retained-refresh behavior
   where applicable. Exercise keyboard interaction and realistic identity/race
   boundaries, not only the happy path.
4. Run the existing project quality checks and inspect the rendered behavior
   only when permitted by the current task; report checks not run when relevant.
5. Leave no sample gallery, temporary route, fake API, or unused abstraction in
   the application unless explicitly requested.

Do not broaden a task into a feature implementation merely because this skill
contains a matching recipe.
