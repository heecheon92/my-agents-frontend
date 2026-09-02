---
name: wire-dialog-sheet-ui
description: Add or update Dialog, Sheet, and Drawer overlays using this repo's shared Base UI/shadcn wrappers, accessibility semantics, footer/header structure, controlled state patterns, and mutation/error handling. Use when building modal forms, destructive confirms, detail panels, record editors, row-triggered overlays, or mobile/desktop overlay branches.
---

# Wire Dialog Sheet UI

Use this skill to match the overlay patterns in `my-agents-frontend`.

Do not treat `Dialog`, `Sheet`, and `Drawer` as interchangeable. Use each primitive for the job it is best suited to, keep accessibility explicit, and keep Client Component boundaries as small as practical.

## Extraction Rule

Do not inline a non-trivial `Dialog`, `Sheet`, or `Drawer` inside a large page or surface component.

Default pattern:

- Extract each non-trivial overlay into its own component file.
- Prefer an overlay component that accepts `children` and uses those children as the trigger surface.
- Keep open state, reset logic, pending state, and submit/delete handlers inside the overlay component by default.
- Prefer the overlay component to own its TanStack Query hook or typed service mutation wiring internally.
- Let the parent pass callbacks only when there is a real reason, such as shared cross-screen orchestration, parent-owned cache patching, or a mutation that must update several sibling surfaces together.
- If a route/page can otherwise stay server-rendered, extract the overlay as a leaf Client Component instead of adding `"use client"` to the broad route shell.

If the overlay is large enough to need explanation, it is large enough to extract.

## Choose The Overlay

Use `Dialog` for:

- short forms and focused modal tasks;
- confirmations and destructive actions;
- pickers and narrow workflows centered on the screen;
- a nested confirmation inside a larger view or sheet;
- admin create/update forms that do not need a full-height editor panel.

Use `Sheet` for:

- side detail panels opened from a list or table row;
- navigation/browser panels on compact screens;
- record editing with multiple sections, tabs, or large bodies;
- overlays that need a persistent footer and full-height layout;
- views that behave like an editor panel rather than a blocking modal.

Use `Drawer` for:

- bottom-up review flows;
- mobile-first or tablet-friendly large previews;
- flows where a bottom sheet should keep context with the underlying page;
- cases where this repo already uses the drawer pattern, such as publish review.

Current repo note: there is no local `AlertDialog` wrapper. Do not add a new primitive just to make a simple confirm. Use a `Dialog` with visible `DialogDescription` for destructive confirms unless the task explicitly introduces and validates a shared `AlertDialog` wrapper.

If the UI is a one-step confirmation, do not turn it into a sheet. If the UI is a record detail editor with multiple sections, do not force it into a narrow dialog.

## Base Imports

Use the repo-local wrappers first:

```tsx
import { Field, inputClassName, selectClassName } from "@/components/Field";
import { EmptyState, ErrorState, Pill } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
```

Rules:

- Prefer `Field`, `inputClassName`, and `selectClassName` for form fields inside overlays before inlining low-level controls.
- Import dialog/sheet/drawer pieces from `@/components/ui/*`, not directly from `@base-ui/*`, `@radix-ui/*`, or `vaul` in feature components.
- The local Base UI wrappers use `render`, not Radix `asChild`. Check the wrapper before composing custom triggers.
- When rendering a non-`button` with `Button` (for example `render={<Link />}`), set `nativeButton={false}` to avoid Base UI native button warnings.
- When using a trigger with `render`, make sure the rendered element matches the primitive's native semantics. A button-like trigger should render a real `<button>` unless the wrapper explicitly opts out of native button semantics.
- Add `DialogDescription`, `SheetDescription`, or `DrawerDescription`. If the design has no visible description, render it with `className="sr-only"` instead of omitting it.
- If there is no visible title, render the title with `className="sr-only"`.

## State Ownership

Inside the extracted overlay component, prefer controlled open state when:

- success should close the overlay;
- open/close must reset local form or selection state;
- permissions can block opening;
- nested overlays or follow-up flows exist;
- submit state or fetched defaults live inside the overlay.

Use uncontrolled state only when a simple `children -> Content -> Close` flow is enough and no reset/success callback is required.

Typical controlled trigger shape:

```tsx
export function SourceDeleteDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* body */}
      </DialogContent>
    </Dialog>
  );
}
```

## Dialog Pattern

Start with this structure for a focused form or confirmation:

```tsx
export function ExampleDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await mutation.mutateAsync(payload);
      setOpen(false);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{localization.title}</DialogTitle>
          <DialogDescription>{localization.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          {mutation.error ? <ErrorState error={mutation.error} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {localization.common.cancel}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {localization.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Project rules:

- Extract the dialog into its own component file when it is non-trivial.
- Expose `children` as the trigger entry point unless the local wrapper requires a different but equivalent trigger pattern.
- Keep the dialog's own query or mutation logic inside the dialog component by default.
- Start with `DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"` for standard forms; widen only when the content genuinely needs it.
- Use `DialogDescription` visibly for destructive confirms and important context.
- Use `DialogDescription className="sr-only"` only when the visible body already provides equivalent context.
- Use controlled `setOpen(false)` when close behavior is part of submit/reset logic.
- Keep `DialogFooter` action order readable. The wrapper is mobile-stacked by default and row-aligned at `sm:`; add explicit classes only for real alignment needs.

## Destructive Confirm Pattern

Use a `Dialog` with visible destructive copy:

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger render={children} />
  <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>{localization.deleteTitle}</DialogTitle>
      <DialogDescription>{localization.deleteDescription}</DialogDescription>
    </DialogHeader>

    {mutation.error ? <ErrorState error={mutation.error} /> : null}

    <DialogFooter>
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        {localization.common.cancel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={mutation.isPending}
        onClick={() => void mutation.mutateAsync(id)}
      >
        {mutation.isPending ? localization.deleting : localization.delete}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Rules:

- Keep destructive copy visible, not hidden.
- Disable destructive actions while pending.
- Close only on confirmed success.
- Do not use `window.confirm` for product UI unless the task is an explicit low-fidelity temporary fallback.

## Sheet Pattern

Start with this structure for side panels:

```tsx
export function ExampleSheet({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={children} />
      <SheetContent
        side="right"
        className="w-full max-w-sm gap-0 border-l border-cal-hairline bg-white p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-cal-hairline p-4 text-left">
          <SheetTitle>{localization.title}</SheetTitle>
          <SheetDescription>{localization.description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{body}</div>
        <SheetFooter className="border-t border-cal-hairline bg-white p-4">
          <SheetClose render={<Button type="button" variant="outline" />}>
            {localization.common.close}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

Project rules:

- Extract the sheet into its own component file when it is non-trivial.
- Right-side sheet is the default for detail/edit panels; set `side="right"` for clarity.
- Use left-side sheets for mobile navigation/browser panels only when that matches the route pattern.
- Most sheets use `p-0`, flex column layout, and internal sections with their own padding.
- Keep footer actions visible and separated with a border when the sheet edits or navigates important state.
- Put scrolling on the body section that needs it, not blindly on every wrapper.
- Use `SheetClose` for standard close actions when possible; use controlled state when close must reset local state.

## Drawer Pattern

Use `Drawer` when a bottom sheet is the better interaction shape:

```tsx
<Drawer
  direction="bottom"
  open={open}
  onOpenChange={(nextOpen) => {
    if (!nextOpen) resetReviewState();
    setOpen(nextOpen);
  }}
>
  <DrawerContent className="max-h-[92dvh] bg-white">
    <DrawerHeader className="items-stretch border-b border-cal-hairline text-left">
      <DrawerTitle>{localization.title}</DrawerTitle>
      <DrawerDescription>{localization.description}</DrawerDescription>
    </DrawerHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">{body}</div>
    <DrawerFooter className="border-t border-cal-hairline bg-white">
      <DrawerClose asChild>
        <Button type="button" variant="outline">
          {localization.common.cancel}
        </Button>
      </DrawerClose>
      {actions}
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

Rules:

- Keep bottom drawers bounded with `max-h-[92dvh]` or similar so the page remains controllable.
- Put long review content inside an internal scroll region.
- Keep mobile footer actions visible and safe-area aware.
- Use `DrawerClose asChild` only when supported by the local drawer wrapper. Check `components/ui/drawer.tsx` before changing this pattern.

## Trigger Variants

Preferred trigger API:

- The extracted overlay component accepts `children` and renders those children through `DialogTrigger` / `SheetTrigger` when supported.
- For Base UI wrappers, use `render={children}` or a wrapper-supported equivalent.

Fallback trigger:

- If the wrapper cannot support a `children` trigger cleanly, expose an equivalent trigger prop or render prop.
- Keep this as the exception, not the default.

Programmatic open:

- Use parent-managed open state only when permission checks, row-level orchestration, or multi-step flows make a trigger-child API genuinely awkward.

## Accessibility Rules

- Every overlay must expose a title.
- Every overlay should expose a description, visible or `sr-only`.
- Prefer visible descriptions for destructive confirms, permissions, irreversible effects, and backend-owned constraints.
- If there is no visible header, add an `sr-only` title and description.
- Do not suppress accessibility warnings by removing semantics; fix the title/description structure.

## Reset And Lifecycle Rules

Reset transient state inside `onOpenChange`, submit success, explicit close handlers, or a small reset helper when the overlay holds:

- selected rows;
- temporary filters/search;
- temporary dates;
- wizard progress;
- form defaults derived from props;
- selected upload files;
- review request state.

Do not rely on component remounts to reset modal state.

## Async And Error Rules

- Render API or mutation errors with `ErrorState` near the form body or overlay root.
- Disable submit/delete buttons while pending.
- Close the overlay only in the success path.
- Use React Query's stored mutation error rather than swallowing or replacing it with a silent fallback.
- Prefer keeping the overlay's query or mutation hook inside the overlay component.
- Push API logic back to the parent only when shared orchestration or parent-owned cache handling makes that necessary.

## Sizing And Overflow Rules

Dialog defaults:

- Standard form: `max-h-[90dvh] overflow-y-auto sm:max-w-lg`.
- Wider form/table/review: use `sm:max-w-xl`, `sm:max-w-2xl`, or `sm:max-w-3xl` only when needed.
- Long dialog bodies need `overflow-y-auto` on `DialogContent` or a dedicated body region.
- Use `overflow-x-hidden`, `break-words`, `break-all`, or `truncate` where backend-owned IDs, filenames, snippets, or URLs can overflow.

Sheet defaults:

- Start from the local `SheetContent` side behavior.
- For full-height panels, add `p-0`, `gap-0`, and an internal `min-h-0 flex-1 overflow-y-auto` body.
- Keep headers/footers outside the scroll region when actions must remain reachable.

Drawer defaults:

- Use bounded height (`max-h-[92dvh]`) plus an internal scroll body.
- Keep footer actions fixed at the bottom of the drawer content.

## Server Component Boundary Rules

Overlay components almost always need `"use client"`, but their parents may not.

Before adding `"use client"` to a broad page or route wrapper:

1. Identify the exact overlay trigger/state/hook that requires the client.
2. Extract that overlay into a leaf component.
3. Pass serializable props from the server parent.
4. Keep the route page/layout server-rendered when possible.

See `docs/next-component-boundaries.md` for the repo-wide rule.

## Common Overlay Shapes

- Extracted form dialog accepting `children` as trigger, closing on success, and showing validation/API errors through `ErrorState`.
- Destructive confirm dialog with visible `DialogDescription`, outline cancel action, and disabled pending destructive action.
- Selection dialog that resets local search/filter state when closed.
- Right-side detail sheet with large body, section dividers, and persistent footer.
- Compact-screen navigation sheet with `showCloseButton={false}` and an explicit `sr-only` title/description.
- Bottom drawer for review/approval content where the body scrolls and approve/reject actions stay reachable.
- Programmatically opened overlay used when row clicks, permission gates, or multiple hotspots make trigger wrappers awkward.

## Avoid

- Do not invent a global modal manager.
- Do not import overlay primitives directly from Base UI, Radix, or Vaul in feature code.
- Do not omit title/description semantics.
- Do not keep stale local state between openings when the overlay is reused.
- Do not use a sheet for a simple confirm.
- Do not use a narrow centered dialog for a large record editor that behaves like a side panel.
- Do not reach for a new overlay dependency before checking whether the existing
  Dialog/Sheet/Drawer primitives cover the case — overlays are the one area this
  repo already has good coverage for. Adding one is allowed when it is clearly
  better (see "Adding UI/UX libraries" in `AGENTS.md`); wrap it in
  `components/ui/` and record the decision in `docs/implementation-log.md`.
- Do not make broad route pages/layouts Client Components just to host one overlay.
