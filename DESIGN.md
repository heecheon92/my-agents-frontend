# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-08-09
- Scope: visual language, layout architecture, component states, accessibility,
  responsive behaviour.
- Companion documents:
  - `docs/korean-copy-guide.md` owns Korean copy: glossary, register,
    anti-patterns, canonical action labels. **Read it before editing any
    user-facing string.**
  - `docs/mobile-responsiveness.md` owns route-local responsive rules.
  - `docs/next-component-boundaries.md` owns Server/Client Component decisions.
  - `docs/backend-requests.md` owns contract gaps this UI is working around.

**This file describes what the code does.** Where something is aspiration
rather than implementation, it says so explicitly. The previous version's main
failure was describing several systems — motion tokens, reduced motion, a
shadow scale — that no code implemented, so readers could not tell the contract
from the wish list.

---

## Brand

A calm, citation-forward AI workspace. Editorial rather than dashboard-noisy:
dense information is fine, but hierarchy must feel curated. The metaphor is
**instrument panel + knowledge dossier** — transcripts, citations, activity,
documents, and permissions read as connected operational evidence.

**Trust signals.** Provenance sits next to answers. Backend-owned limits are
stated honestly. Errors explain the next safe step without exposing internals.

**Audience.** Readers are technically literate and want to see *how* an answer
was produced, not only that it appeared. That is a design
input, not just context: the retrieval pipeline, agent trace, citation chunks,
and extraction stages are **evidence of how the system works, and should stay
legible rather than be smoothed away**. Name the pipeline accurately in
inspection surfaces — `임베딩`, `청크`, `엔티티`, `색인` are correct there, and
`docs/korean-copy-guide.md` records the boundary. This never licenses leaking
internals: raw enums, identifiers in a primary reading path, stack traces, and
provider detail stay out regardless of who is reading.

**Avoid.** Generic AI gradients, purple-on-white SaaS tropes, glassmorphism,
floating orbs, decorative chat bubbles without provenance. Low-contrast
gray-on-gray metadata. Raw identifiers, enums, or ISO timestamps in the primary
reading path — those belong in an advanced disclosure.

---

## Visual language

### Colour

Direction: **ink, parchment, and signal**. `app/globals.css` is the only place
colour is defined.

`--km-*` holds the real values; `--cal-*` aliases `--km-*` one-for-one and
exists only for historical call sites. Product code uses `cal-*` about three
times as often as `km-*`. **Do not bulk-rename between them** — alias, migrate
in small batches, and verify with the visual-evidence harness.

Light theme (`:root`): warm off-white canvas `#fbfaf7`, white surface, deep navy
primary `#14213d`, teal accent `#0f766e`.

Dark theme (`.dark`): warm charcoals that keep the light theme's hue bias, so it
reads as the same product rather than a different one. Two constraints worth
knowing before touching it:

- **Every `--km-*` value is redefined in `.dark`.** Before 2026-08, only the
  shadcn semantic layer was, while ~95% of markup uses `km-*`/`cal-*` directly —
  so the theme rendered half-light. If you add a token, add both values.
- **`--km-primary` stays a dark navy (`#2f4372`) in dark mode, not a light
  fill.** Around fourteen components pair it with a hardcoded `text-white`; a
  light primary would render white-on-white. It is lifted enough to separate
  from the canvas while keeping 9.8:1 against white text.

**No palette literals.** `bg-white`, `text-amber-900`, and friends do not switch
with the theme. There are currently zero in the app, and
`e2e/theme.spec.ts` will catch reintroductions by measuring real contrast.

### Typography

**Pretendard**, self-hosted from `public/fonts/pretendard/` under SIL OFL 1.1,
as 92 unicode-range subsets. A Korean screen fetches roughly 150–400KB instead
of the 2.1MB full variable file. It is plain `@font-face` CSS rather than
`next/font/local` because that API cannot express per-file `unicode-range`.
Geist Mono remains for payloads and identifiers.

Korean-specific rules, all enforced in `app/globals.css`:

- `word-break: keep-all` so Hangul breaks at spaces, with
  `overflow-wrap: break-word` so a long filename still wraps.
- **No negative letter-spacing.** Tightening tracking is a Latin display
  technique; it smudges the jamo inside a Hangul syllable block.
- Body text ≥16px. Metadata may use 13px only when non-essential and
  high-contrast.

`e2e/typography.spec.ts` asserts Pretendard is what body text resolves to and
that line breaks do not land inside words.

### Shape, elevation, motion

Semantic tokens, defined in `@theme`:

| Token | Value | Use |
|---|---|---|
| `rounded-control` | 10px | buttons, inputs |
| `rounded-card` | 16px | cards, panels |
| `rounded-pane` | 20px | workspace panes |
| `shadow-control` / `shadow-card` / `shadow-raised` / `shadow-overlay` | see `--elevation-*` | elevation, redefined for dark |
| `ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | all transitions |
| `--duration-fast` / `--duration-panel` | 150ms / 220ms | hover-focus / panel reveal |

Prefer borders over shadows. A global `prefers-reduced-motion` block collapses
animation; its `!important` is load-bearing, because Tailwind's `duration-*`
utilities outrank a universal selector.

### Scrollbars

One canonical scrollbar, applied globally in `app/globals.css` — components do
not style their own. Thin thumb in `--km-scrollbar-thumb` (a step darker than
`hairline`, a step lighter than `muted`, defined per theme), transparent track.

**Use the standard properties, not `::-webkit-scrollbar`.** Giving
`::-webkit-scrollbar` a width opts the element out of macOS overlay scrollbars,
so it becomes a permanent classic bar that occupies layout width — on `/chat`
that silently narrows the transcript and the sidebar on every machine left at
the default "Show scroll bars: automatically". `scrollbar-width: thin` plus
`scrollbar-color` restyles the scrollbar in both overlay and always-visible
modes while keeping the gutter at zero.

The `::-webkit-` rules that remain are fenced behind
`@supports not (scrollbar-width: thin)` and exist only for browsers that
predate the standard properties. Do not lift them out of that guard to get
rounder corners; the layout cost is not worth it.

---

## Layout architecture

This is the part most likely to be broken by a well-meaning change.

### The shell owns scrolling

`ServiceShell` is `h-dvh`. That bounds `SidebarInset`, so the content region is
the page's only scroller. Routes therefore **never** compute their own height
from the viewport.

Each route declares a layout mode in `navRoutes`:

- **`fill`** (`/chat`) — the content box is `overflow-hidden` and fixed-height;
  the route divides that height up and manages its own internal scrolling.
- **`scroll`** (everything else) — the content region scrolls normally.

The mode is derived from `usePathname()`, which `ServiceShell` already calls.
The alternative — a `app/(service)/chat/layout.tsx` threading one boolean — was
rejected as more machinery than the decision deserves. That is a trade, recorded
here rather than hidden.

> **Do not reintroduce `calc(100dvh - …)` in a route.** The previous
> `h-[calc(100dvh-8rem)]` assumed 64px of shell padding while the shell actually
> uses `p-4` at mobile — the panel was ~32px short at exactly the widths that
> mattered. `tests/chatworkspace-footer.test.ts` fails if it returns.

### `/knowledge` and `/groups` keep `min-h-[calc(100dvh-11rem)]`

This looks like the same mistake and is not. It is a `min-height` floor inside a
scrolling container, not a fixed height, and it works. **Do not convert these to
`fill` mode**: their internal `<aside>` would have to grow its own scroller,
creating the nested scroll regions `docs/mobile-responsiveness.md` forbids.

### Compact-screen browsers are Sheets

The admin list-plus-detail routes use the same pattern: a persistent browser on
wide screens, the same component inside a left `Sheet` below the breakpoint.

| Route | Breakpoint | Sheet |
|---|---|---|
| `/knowledge` | `lg` | `SourceSpaceBrowserSheet` |
| `/groups` | `lg` | `GroupsChrome` |

The list component takes its chrome via `className` so one implementation
serves both. Selecting an item closes the sheet.

**`/chat` is no longer one of them.** Its conversation history lives in the
shell sidebar, which is already a left `Sheet` below `md` — so the route-local
`ConversationBrowserSheet` and its second panel-left trigger were removed rather
than maintained alongside the shell's own `SidebarTrigger`.

### Conversation history lives in the shell sidebar

`ServiceShell` renders `ConversationHistorySidebarGroup` under
`currentRoute.key === "chat"`. Three constraints hold it together; each was a
real bug or a real test failure.

**It shares the query cache, not a context.** The history takes no props —
`ChatWorkspace` is its sibling, not its ancestor. Both read
`MyAgentsQueryKeys.conversations.list()`, and `staleTime: 60_000` means the
second observer costs no network. A context would have to wrap `ServiceShell`,
leaking chat state onto `/knowledge`, `/groups`, and `/settings` and re-rendering
the streaming route subtree on every change. A layout slot would need a parallel
route to sit above the shell — more machinery than the
`app/(service)/chat/layout.tsx` already rejected above.

The one exception is `components/chat/chat-activity-store.ts`, a zustand store
holding **`busyConversationId` and nothing else**, because the delete button
needs a client-only run state the cache cannot carry. Putting anything
high-frequency there rebuilds the rejected context with worse ergonomics.

**The history group hides with `hidden`, never `opacity-0`.**
`e2e/sidebar-persistence.spec.ts` filters sidebar buttons by
`offsetParent !== null`, which only goes null under `display: none`. An
opacity-based hide leaves the rows in the collapsed-rail 32×32 assertions.
`SidebarGroupLabel` uses `opacity-0` — do not copy that idiom here.

**Conversation rows are not `SidebarMenuButton`s.** They keep
`getConversationCardClassName` (whose token set is asserted in
`tests/chatworkspace-footer.test.ts`), they contain a nested delete button, and
they are variable-height. The `새 대화` button *is* a `SidebarMenuButton`, and
sits outside the hidden group so it survives the icon-rail collapse.

Gating is by not rendering, not by CSS: `useConversations()` has no `enabled`
flag, so mounting the history on another route would fetch conversations that
route never shows.

### The composer floats over the transcript

The composer is `absolute inset-x-0 bottom-0` inside the panel, and its
container is transparent — messages scroll *behind* it. The transcript runs the
full height beneath the header rather than stopping above a footer band.

Two things keep that honest, and both must move together:

- **The transcript reserves the composer's height as scrollable padding**, set
  inline from a `ResizeObserver` in `ChatWorkspaceLayout`. Measured, not
  guessed: the composer grows with the draft, with a queued-message card, and
  with error copy, so a fixed inset would either hide the last message or leave
  a permanent gap. The padding is inline because
  `CHAT_SCROLL_REGION_CLASS_NAME` is asserted verbatim, `calc(`-free, in
  `tests/chatworkspace-footer.test.ts`.
- **The wrapper is `pointer-events-none`, the form is `pointer-events-auto`.**
  Otherwise the transparent band around the input would swallow clicks and text
  selection on the messages visible through it.

The input box itself keeps an opaque background. Only the container is
transparent — text must never show through the field you are typing into.

### The composer is a stack, and send is a circle

Textarea on top, one control row beneath it: source scope at the left, effort
and send at the right. Not a grid with send as a side column — that made the
button stretch to the height of the text, so a four-line draft got a
full-height slab of a button beside it.

Everything on the control row is a compact trigger or an icon. Settings live
one click behind them:

| Control | Collapsed to | Opens |
|---|---|---|
| knowledge scope | chip stating the current scope | Dialog (desktop) / Drawer (mobile) |
| reasoning | ghost trigger stating the current effort | Popover |
| send | circular icon, fixed `size-9` | — |

The rule is that **a collapsed trigger states its current value**. `보통 ⌄` and
`문서 3개 ⌄` mean nothing is hidden, only moved; a trigger reading only
`설정` would be hiding state.

Send is icon-only, so its label moves to `aria-label`/`title` rather than being
dropped, and it still changes with state — `보내기` becomes `대기열에 추가`
while a run is in flight.

Use `components/ui/popover.tsx`, not `DropdownMenu`, for panels containing form
controls. A menu takes over arrow keys for roving focus, which fights the
effort slider inside it.

### `/chat` is a route, and bare `/chat` is a new conversation

Selection is `app/(service)/chat/[conversationId]`, mirroring
`/knowledge/[sourceId]`. Bare `/chat` deliberately does **not** fall back to the
most recent conversation: it is the new-chat state, and the composer stays live
there — sending the first message creates the conversation
(`ensureConversationId` in `ChatWorkspace`) and then runs it. `새 대화` is
therefore a link, not a POST, so an accidental click cannot leave an empty
conversation behind.

---

## Interaction states

- **Loading** — sketch the shape that is coming (`ui/skeleton.tsx`), not a bare
  word on a blank page. Keep an `aria-live` announcement.
- **Empty** — name the missing thing and the next action. An empty list because
  a *filter* matched nothing is a different message from an empty list.
- **Error** — `ErrorState` never renders `error.message`. It maps HTTP status to
  localized copy via `utils/error-message.ts`. Backend `detail` is deliberately
  not shown: it is English prose, and English inside Korean copy is worse than
  generic Korean. See `docs/backend-requests.md` for the error-code request that
  will restore specificity.
- **Disabled** — explain the blocker in nearby copy, do not just grey out.

---

## Components

**Do not add a second component library.** Base UI primitives live in
`components/ui/`, always imported from there and never from `@base-ui/*` or
`vaul` directly.

### Overlays

Dialog for short forms, confirms, and pickers. Sheet for compact-screen
navigation and row detail. Drawer for bottom-up review. Every overlay needs a
Title and Description, `sr-only` if not visible. Extract non-trivial overlays to
their own file with their own state.

**Do not render the same action in two places at once.** The publish review
drawer had approve/reject in its header *and* its mobile footer with no
breakpoint between them.

### Action hierarchy

One primary action per surface. When a card offers a review step and a direct
decision, review is primary — "approve without reading" should not look as
routine as "review".

Action labels come from the canonical table in `docs/korean-copy-guide.md`.
Before adding a button, check whether the action already has a name.

---

## Accessibility

Target: WCAG 2.2 AA, AA+ preferred for metadata since the product is
evidence-heavy.

- Dark-mode contrast is measured, not assumed: `e2e/theme.spec.ts` computes real
  ratios from rendered colours across three routes and applies the large-text
  threshold only where the font size qualifies.
- Semantics must match intent. A `<fieldset>` announces a group of form
  controls; a set of disclosures attached to a message is a `<section>`.
- Icon-only controls need an accessible name that conveys state, not just
  function — the theme toggle names both the current mode and the next.
- Touch targets ≥44px for primary controls.
- Korean input commits syllables with Enter, so **any Enter-to-submit handler
  must check `event.nativeEvent.isComposing`**. Without it the composer fires
  mid-word on essentially every Korean sentence.

---

## Responsive behaviour

Verified at **390 / 768 / 1280** by `e2e/visual-evidence.spec.ts`, which
screenshots every route and gates on horizontal overflow at 390px.

Preserve working desktop layouts; add compact branches rather than degrading
wide ones. Avoid nested scroll regions. Wrap identifiers and filenames rather
than letting them overflow. Footers that sit at the bottom of the viewport need
`env(safe-area-inset-bottom)`.

---

## Verification

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm exec vitest run
pnpm exec playwright test          # fully mocked, no backend required
pnpm build
```

Visual evidence, before and after a visual change:

```bash
VISUAL_EVIDENCE_LABEL=before pnpm exec playwright test visual-evidence
```

Screenshots land in `test-results/visual-evidence/<label>/` (gitignored).

**Standing checklist when touching chat, the shell, or any list route:** grep
`OnboardingTarget id=` in every file you changed and confirm each target is
mounted and visible at all three widths. A target inside a closed Sheet
spotlights nothing, and the tour fails silently.

---

## Resolved decisions

Previously open, now settled:

- **Typography** — Pretendard, self-hosted. IBM Plex Sans KR was the earlier
  proposal; Pretendard reads more native in Korean product context.
- **Dark mode** — shipped, with a cookie-read preference and no `next-themes`.
- **Terminology** — items are `문서`, containers are `지식 베이스`. Full glossary
  in `docs/korean-copy-guide.md`.
- **`cal-*` migration** — keep as aliases. Renaming has no user benefit and
  real regression risk.

## Open questions

- [ ] **Guest limits are hardcoded in copy.** `24시간`, `대화 1개`, `질문 5개`,
  `문서 3개` appear in five strings, taken from `.env.example` — which is not
  production; production configuration lives outside this repo. If the deployed
  values differ, the product states limits that are wrong. `/auth/me` already
  carries `guest_expires_at`, so the session-length case can be fixed today;
  the counts need the backend request filed in `docs/backend-requests.md`.

- [ ] **Product name.** The visible brand is still `my-agents`; the `km-` token
  prefix hints at an unused "Keymesh". Affects brand lockup, metadata, nav.
- [ ] **`Ask` as a nav label.** The only untranslated nav item. Defensible as a
  product name, but it is currently an accident rather than a decision.
- [ ] **Activity event display contract.** The frontend localizes the event
  types it could find and falls back to a de-snaked label for the rest. A
  documented enum would let the timeline render properly — requested in
  `docs/backend-requests.md`.
- [ ] **Unused localization keys.** 76 leaf keys are not referenced anywhere in
  source. Most are genuinely dead, but some may be reached by dynamic index, so
  a bulk delete is unsafe without per-key checking. Worth a dedicated pass.

- [x] **Ingestion progress — built.** Not a never-built feature, and the
  earlier removal was correct.

  **What actually happened.** `956cc6c` (2026-05-22) shipped per-file progress
  alongside backend `50461d3`, which added observable stages. Crucially the
  frontend never rendered the backend value — it built its own queue bar:

  ```
  40 + Math.round(progress_percent * 0.6)
  ```

  with synthetic milestones for uploading (10), uploaded (35), and queued (40).
  Then `2aaaa75` moved hosted ingestion to an external worker, so a run could
  sit queued at backend 0% for an unbounded time — which this formula rendered
  as **40%**. A bar sitting at 40% claims the document is nearly half processed
  when no worker has touched it. `a081ef6` replaced the bars with indeterminate
  spinners 19 seconds later. That was the right call.

  **Two separate defects, worth keeping distinct.** The queue bar was partly
  fabricated; and backend percentages are *milestone commits*, not measurements
  — `45` means "reached the embedding stage", not "45% of the time elapsed", so
  a large embedding step can hold at 45 for most of the run.

  **What ships now.** `resolveUploadProgress` in `UploadQueueRow` is the whole
  rule, exported and unit-tested rather than inlined, and the poll passes
  `progress_percent` and `stage` through instead of writing `0`:

  - `queued` — indeterminate, labelled as waiting for a worker. No percentage.
  - `claimed` … `metadata` — stage name plus the backend milestone percentage.
  - `completed` — 100%.
  - uploading and publishing — indeterminate, since no real byte or request
    progress exists for them.
  - No ETA, and nothing implying the percentage is linear in time.

  The milestone spacing (0, 1, 15, 45, 70, 85, 95, 100) already encodes relative
  cost, which is why the percentage is worth keeping over a plain step counter:
  the 30-point jump across embedding says something a "step 4 of 7" indicator
  would throw away.

  Because a run can legitimately hold at one milestone for a while, `queued`
  says so in words rather than showing a zero — the "is this stalled?" question
  is the case the whole feature exists for. No backend change was required for
  any of this; the value had been arriving and being discarded since May.

  The related raw-enum bug in `SourceIngestionHistory` is fixed:
  `describeExtractionStage` localizes the stage with a de-snaked fallback, and
  `tests/extraction-stage-copy.test.ts` drives off the zod enum so a new backend
  stage fails the build rather than leaking into the UI.
