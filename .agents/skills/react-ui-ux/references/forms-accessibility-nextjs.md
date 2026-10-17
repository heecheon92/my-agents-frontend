# Forms, Accessibility, and Next.js

Use this reference when changing forms, accessibility, localization, Server or Client Components, route loading, hydration, or URL-backed selection. The Next.js section applies only when the project uses Next.js.

## Native Form Semantics

Use native forms for focused edits so keyboard behavior works automatically.

### Bad

```tsx
<input value={name} onChange={...} />
<button type="button" onClick={save}>Save</button>
```

Pressing Enter does nothing.

### Good

```tsx
<form
  onSubmit={(event) => {
    event.preventDefault()
    if (canSave) mutation.mutate(name.trim())
  }}
>
  <label htmlFor="display-name">Display name</label>
  <input id="display-name" value={name} onChange={...} />
  <button type="submit" disabled={!canSave}>Save</button>
  <button type="button" onClick={cancel}>Cancel</button>
</form>
```

Use associated labels, `aria-describedby` for validation, `role="alert"` for active errors, and a disabled submit during pending.

## Next.js Component Boundaries

Apply this section only in Next.js projects.

- Keep route composition and safe initial reads on the server when they improve first paint.
- Use Client Components for state, browser APIs, lifecycle, and event handlers.
- Do not call client hooks from a Server Component. Add `"use client"` at the smallest cohesive interactive boundary.
- Do not gate useful initial content behind hydration when the server can provide it safely.
- Do not split a cohesive editor only to maximize Server Component count.
- Prefer URL state when selection is navigable.
- A route `loading.tsx` may reuse the same size-matched route-local state for server transitions, but it complements rather than replaces client-query regional boundaries.

## Localization and Design Contracts

- Never hardcode user-facing copy when the project has localization.
- Reuse shared class contracts and Skeleton primitives.
- Static labels stay visible during loading; only values become Skeletons.
- Do not invent selected-item subtitles, badges, or helper copy without design or PRD evidence.
- Follow the target route's actual dimensions, spacing, and shared classes, backed by its current implementation, design source, or PRD.
- Use the target project's own design evidence as styling authority; do not import another product's classes or branding as defaults.
