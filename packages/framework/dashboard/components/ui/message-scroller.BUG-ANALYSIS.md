# Bug analysis: packages/framework/dashboard/components/ui/message-scroller.tsx

## Business logic (high-level)

The live transcript container (message-scroller.SPEC.md): follow the live edge, hold still when
the reader scrolls back (anchor on message boundaries), a "Jump to latest" pill that goes inert
when there is nothing to scroll, and the app's own quiet scrollbar. All of the *behavior* lives in
the `@shadcn/react/message-scroller` primitive (present in node_modules, v0.2.1); this file is the
styled wrappers plus re-exports, so the checkable surface here is: correct primitive part per
wrapper, correct data-slot hooks, and the class strings that carry the #914 scrollbar styling.

Class-string audit (the part that can silently break, per the test file):

- Viewport: `scroll-fade-b scrollbar-thin scrollbar-gutter-stable data-autoscrolling:scrollbar-quiet`
  — each bare utility is defined in `tailwind.css` (`@utility scrollbar-thin` etc.; the sibling
  test pins the pairing). The `data-autoscrolling:` variant relies on the primitive stamping a
  `data-autoscrolling` attribute on the viewport, which is the primitive's documented contract.
- Button: active/inactive transitions keyed off `data-[active=…]` and `data-[direction=…]`;
  `data-direction` is set explicitly alongside the `direction` prop so the CSS selector always has
  the attribute even if the primitive did not mirror it. Inactive: pointer-events-none + fade —
  the SPEC's "stops accepting clicks entirely". Correct.
- Item: `scrollAnchor` defaults to `false` here and is forwarded — callers opt message boundaries
  in; `min-w-0 shrink-0` prevents flex collapse. Correct.
- Default button children read "Jump to latest" with a down arrow even for `direction="start"`
  (where "latest" would be wrong) — every caller uses the default end direction; a `start` caller
  passes its own children. Reliance noted, not a bug.

## Functions (low-level)

- `MessageScrollerProvider` — direct re-export of the primitive's Provider (no styling to add);
  uniform import site. Correct.
- `MessageScroller` (Root wrapper) — `group/message-scroller relative flex size-full min-h-0
  flex-col overflow-hidden` + overrides. Correct.
- `MessageScrollerViewport` — see class audit. Correct.
- `MessageScrollerContent` — `flex h-max min-h-full flex-col`: lets content grow past the
  viewport while filling it when short. Correct.
- `MessageScrollerItem` — see above. Correct.
- `MessageScrollerButton` — see class audit; children default noted. Correct.
- Hook re-exports (`useMessageScroller`, `useMessageScrollerScrollable`,
  `useMessageScrollerVisibility`) — pass-through. Correct.

## Bugs found

None found.
