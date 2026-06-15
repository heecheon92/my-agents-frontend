# Mobile Responsiveness

This document expands the repo-wide responsive rules for product route work.

## Core Rule

- Do not degrade or rewrite the desktop layout just to make mobile work.
- Preserve the desktop shell and add a mobile-specific branch only where needed.
- Keep the Ask/chat experience readable first; admin density should collapse into clear stacked flows on smaller screens.

## Route Pattern

- Prefer route-local mobile shells in the owning route/layout or screen component.
- If a section needs a different mobile header, create or reuse a route-local mobile header component instead of adding page-specific header markup throughout children.
- Keep shared account, logout, title, and navigation wiring reusable between desktop and mobile variants.
- When a route provides its own mobile header, make the global shell opt out cleanly from duplicate mobile chrome such as floating sidebar triggers, extra top padding, or repeated titles.

## Screen-Level Pattern

For complex screens, prefer explicit desktop/mobile render branches inside the route-local screen component.

- Reuse shared data shaping and small presentational pieces between branches.
- On mobile, default to vertical flow and stacked sections.
- Avoid nested scroll regions on mobile unless the interaction truly requires them.
- Prevent horizontal overflow for long filenames, source IDs, document IDs, citations, and backend-owned labels.
- Keep touch targets comfortable and action groups reachable without requiring horizontal scrolling.

## Overlay Pattern

- Keep desktop `Dialog`, `Sheet`, table, or split-pane behavior intact when that is already working.
- If mobile interaction needs a different overlay shape, add a mobile-specific `Drawer` or sheet branch rather than forcing one overlay to satisfy both desktop and mobile behavior.
- Keep footer actions visible and safe-area aware on mobile overlays.
- Destructive and submit actions should remain distinguishable and reachable when the on-screen keyboard is open.

## Examples In This Repo

- `/chat`: composer, source selector, citations, and activity evidence must remain usable without horizontal overflow.
- `/knowledge`: source-space navigation can use a persistent desktop tree and compact-screen sheet/browser.
- `/groups`: group browser and management sections can share data but may need separate desktop overview and mobile stacked branches.
- Auth routes: login/signup/password flows should stay single-column and keyboard-friendly on mobile while preserving desktop polish.
