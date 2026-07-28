`useIsMobile()` — `matchMedia`-backed boolean for viewports under 768px, below which the sidebar switches to an off-canvas Sheet (shadcn's default).

## Facts

- `matchMedia` only runs in the effect, so the prerender (ssr:false) and jsdom resolve to `false` and it flips in the browser; environments without `window.matchMedia` default to not-mobile rather than throwing.
