Swaps the tab icon between the idle mark and the animated working variant while an agent runs (#875) — the half of the signal you see while the dashboard tab is in the background.

## TLDR

- `IDLE_FAVICON` = `/logo.svg` (neutral ramp, own dark-mode fills inside the file); `WORKING_FAVICON` = `/logo-animated.svg` (plain SVG `<animate>`, needs no script).
- `faviconHref(working)` — the state → file mapping; `useFavicon(working, enabled?)` — client-only effect rewriting the `<link rel~="icon">` href, creating the link if the page has none.
- `enabled=false` where the caller is not the one that knows: the shell hands the tab over to the relay view, which reads a single run's feed rather than the project registry.

## Facts

- Vike's `favicon` config (pages/+config.ts) only emits the initial `<link rel="icon">`, so the swap must be a client-side href write.
- The href write is guarded (skip when unchanged): writing the same href re-fetches the icon in some browsers, restarting the animation every render.
- Selector is `link[rel~="icon"]` because the emitted rel can carry more than one token.
