Styled wrappers around `@shadcn/react`'s dependency-free `message-scroller` primitive (ported by hand, #712 — no components.json here): the chat-log viewport that follows the live edge, plus a "Jump to latest" button.

## TLDR

- `MessageScrollerProvider` (the primitive's, re-exported unwrapped — it takes no styling), `MessageScroller` (Root), `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem` (`scrollAnchor` defaults false), `MessageScrollerButton`, plus the primitive's hooks re-exported.
- Behavior (follow live edge, preserve visible rows, anchor on turn boundaries, inert-when-not-scrollable button) lives entirely in the primitive; this file is presentation only.
- The button floats centered, animates in/out via `data-[active]`/`data-[direction]`, defaults to "Jump to latest" + ArrowDown.

## Decisions

- Adapted from upstream's `bases/base` variant: repo's own `cn`, a native `<button>` (the repo `Button` is not Base-UI render-ready) instead of `render={<Button/>}`, lucide instead of the icon placeholder.
- Upstream's `scrollbar-thin`/`scrollbar-thumb-*` came from the tailwind-scrollbar plugin; #914 replaces them with three local `@utility` definitions in `layouts/tailwind.css` on plain `scrollbar-width`/`scrollbar-color`/`scrollbar-gutter`, so the log's bar is toned like the app instead of OS-painted.

## Facts

- Viewport classes `scroll-fade-b scrollbar-thin scrollbar-gutter-stable data-autoscrolling:scrollbar-quiet` are the contract pinned by `message-scroller.test.tsx` — an undefined utility fails silently.
- Every part carries a `data-slot="message-scroller*"` attribute.
