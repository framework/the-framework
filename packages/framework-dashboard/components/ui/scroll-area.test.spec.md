Tests for `scroll-area.tsx` (#913) — covers that children land inside the scrolled viewport, `viewportRef` hands the viewport element out, and the bar/thumb are drawn from theme tokens rather than the OS scrollbar.

## Facts

- Pins `bg-muted-foreground/40` on the thumb: muted-foreground rather than border tone, because a border-toned thumb vanishes on the dark canvas.
- Deliberately asserts only structure/classes — bar size and visibility are layout, which jsdom does not do.
