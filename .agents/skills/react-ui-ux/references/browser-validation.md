# Browser Validation

Read this reference before completing meaningful UI behavior changes or reviews.

Use the target project's actual check commands and available browser tooling, within the task's permitted scope. Do not run checks forbidden by the task; report unexercised checks and scenarios rather than claiming they passed.

## Required Validation

For meaningful UI changes:

1. run focused pure or state tests,
2. run TypeScript and lint checks,
3. run the production build,
4. browser-drive the actual route and throttle or delay the owning reads,
5. exercise pending, error, Retry, and success,
6. verify mutation controls are absent or disabled before authoritative success,
7. verify list and shell DOM stay mounted during detail selection,
8. verify keyboard submit for forms,
9. report untested live-data cases honestly.

## Browser Proof Example

Mark a stable rail element before selection:

```js
link.dataset.qaPersistent = "schedule-link"
```

Delay the detail request, activate the row, then assert during pending:

```js
document.querySelector('[data-qa-persistent="schedule-link"]') !== null
```

Also assert Skeleton count, static labels, disabled actions, and inline Retry after a mocked failure.

## Review Checklist

Before declaring done:

- [ ] User action is reflected synchronously.
- [ ] Stable shell or list mounts on the cold initial collection read and does not unmount.
- [ ] Skeletons reuse final containers and dimensions closely enough to avoid layout shift.
- [ ] Skeleton matches final value, row, or card shape.
- [ ] Static title, labels, and tabs remain visible.
- [ ] Loading, empty, and error are distinct.
- [ ] Initial error is retryable in context.
- [ ] Cached or paused success cannot authorize mutations.
- [ ] Fresh detail hydrates draft only once per selection.
- [ ] Background refetch cannot overwrite edits.
- [ ] Mutation functions fail closed.
- [ ] Native form submission works with Enter.
- [ ] Localization and accessibility are complete.
- [ ] Focused tests, lint, build, and browser QA passed.
