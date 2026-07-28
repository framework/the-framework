shadcn's Base UI `scroll-area`, hand-ported (#913, same route as message-scroller #712): a themed, always-visible-while-overflowing scrollbar replacing the self-hiding OS overlay bar.

## TLDR

- `ScrollArea` renders Root → Viewport (children) → `ScrollBar` → Corner, each tagged `data-slot="scroll-area*"`.
- `viewportRef` exposes the scrolled element for rails that scroll themselves (ViewsRail, ChoicesRail); `viewportClassName` replaces the default `h-full` on the viewport.
- `ScrollBar` is vertical-only: a slim `w-2.5` strip whose thumb is `bg-muted-foreground/40`, darkening on hover; it unmounts when content fits, so a short list shows no bar.

## Decisions

- A component rather than styling the native bar: OS overlay scrollbars hide themselves, so a rail gave no hint it held more than shown. #710 still stands for everything not converted — no `::-webkit-scrollbar` rule comes back.
- Upstream's `cn-scroll-area-*` registry stylesheet (`@apply` rules) is inlined onto the parts since there's no components.json; focus ring uses the repo's own token.
- No focus ring on the viewport — a scroll region is not a control, and the ring painted a green box down the sidebar edge — but it stays focusable for keyboard scrolling (`outline-none`, no `tabIndex` removal).
- Thumb tone is `muted-foreground`, not `border`: a border-toned thumb disappears into the dark canvas.
- Vertical only on purpose; upstream's horizontal branch would ship untested — add it with its first use.

## Facts

- Height-cap gotcha documented on `viewportClassName`: `max-h-*` on the Root only caps the box — the viewport's `h-full` can't resolve against a parent's max-height, so content grows instead of scrolling. Callers (dropdown, popover, editor) must put the cap on the viewport.
