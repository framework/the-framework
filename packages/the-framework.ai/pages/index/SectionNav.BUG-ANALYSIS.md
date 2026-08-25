# Bug analysis: packages/the-framework.ai/pages/index/SectionNav.tsx

## Business logic (high-level)

The landing page's "On this page" table of contents: an "On this page" kicker followed by a `position: sticky` bar listing the five sections. Three behaviors, all specified in `SectionNav.SPEC.md`:

1. **The bar follows the reader.** A scroll listener re-computes which section is current and highlights it, and keeps `window.location.hash` in step so a copied/bookmarked URL points at what the visitor was reading.
2. **Nothing is highlighted on the closing screen.** Near the bottom of the document the highlight (and the hash) are cleared.
3. **Back to top once stuck.** The logo fades in only while the bar is stuck at the top, and clicking it smooth-scrolls to the hero.

**The spy algorithm.** `spyLine = max(130, innerHeight * 0.55)`; the sections are walked *in document order* and the last one whose `getBoundingClientRect().top <= spyLine` wins. This is correct only because `SECTIONS` is in the same order as `pages/index/+Page.tsx` renders them — it is (stop-babysitting, autonomous-ai, how-it-works, features, your-framework). The `sectionStyle` rhythm is a margin rather than padding, so `rect.top` is the top of the *content*, which is what makes "content crossed the mid-line" mean what it says. After a nav click the target lands at y=76 (`section[id] { scroll-margin-top: 76px }`), well under `spyLine`, and every earlier section is above it — so the clicked entry is the one that ends up highlighted. At the very top of the page no section qualifies and `a` stays `''`, which is the intended "nothing highlighted yet" state.

**Bottom-of-page clearing.** `innerHeight + scrollY >= scrollHeight - 120` fires inside the `Cta` screen (its `clamp(104px,16vw,220px)` bottom padding plus the footer keep the last real section well clear of that 120px band), satisfying SPEC point 2.

**Hash syncing.** Only written when it actually changes, via `history.replaceState` (never `pushState`), so scrolling never pollutes the back stack and never triggers a scroll of its own (unlike assigning `location.hash`). Passing `null` as the state object is safe under Vike's Client Routing: Vike monkey-patches `history.replaceState` and re-attaches its own `state.vike` payload to any non-enhanced state, so the router's scroll-restoration data is not destroyed. When nothing is active it restores `pathname + search`, correctly preserving a query string.

**Interaction with Vike's link interception.** The nav's `<a href="#id">` links are same-page hash links: Vike's `isLinkSkipped` short-circuits on `href.startsWith('#')` and lets the browser navigate natively (CSS `scroll-behavior: smooth` then animates it). One case goes through Vike instead: when the spy has already synced the hash to the section the visitor clicks, Vike's `isHrefCurrentUrl` branch calls `scrollToHashOrTop`, which does `getElementById(id).scrollIntoView()` — that honours `scroll-margin-top` and `scroll-behavior`, i.e. the same result. The back-to-top anchor calls `preventDefault()` in React before Vike sees it, and Vike skips it anyway (hash link), so only the JS smooth scroll runs.

**Lifecycle.** One `scroll` listener, registered `{ passive: true }` in a `useEffect` with an empty dependency array and removed in the cleanup — no leak across Vike client-side navigations. `onScroll()` is also invoked once on mount so a page loaded mid-document (or with a hash) is highlighted immediately without waiting for a scroll. Both `setActive` and `setStuck` are called on every scroll event, but React bails out when the value is unchanged, so there is no render storm.

Known non-defects worth recording:
- There is no `resize`/`orientationchange` listener, so after a window resize the highlight can be one section stale until the next scroll event. Self-healing, invisible on mobile (the whole bar is `display: none` below 860px), and never wrong for more than one gesture — not reported as a bug.
- Below 860px the bar is hidden by CSS but the effect keeps running: `getBoundingClientRect()` on a `display: none` element returns zeros, so `stuck` is permanently `true` there. It only drives the hidden bar's background/border, so nothing is visibly wrong; the hash keeps syncing, which is still desirable.
- During a smooth scroll started by a nav click, intermediate sections briefly rewrite the hash; the final value is the clicked section. `replaceState` cannot cancel the ongoing scroll.

## Functions (low-level)

- **`SECTIONS`** — the five `{ id, title }` entries (`your-framework` also carries `italicFirst`), `as const`. Must match both the ids rendered on the page and their document order; both hold. Verdict: correct.
- **`scrollTop(e)`** — `preventDefault()` then `window.scrollTo({ top: 0, behavior: 'smooth' })`. Prevents the native `#top` jump so the scroll is animated even where `scroll-behavior` might not apply, and deliberately leaves the URL alone (the spy clears the hash a moment later, once no section qualifies). Verdict: correct.
- **`SectionNav()`** — the component.
  - `active` / `stuck` both start at `''`/`false`, which is exactly what the prerendered HTML contains, so hydration cannot mismatch; the mount-time `onScroll()` then corrects both.
  - `barRef` is only read inside the handler, after mount, and is null-guarded (`barRef.current ? … : false`).
  - The `<a href="#top">` back-to-top gets `aria-hidden={!stuck}`, `tabIndex={stuck ? undefined : -1}` and `pointerEvents: 'none'` while hidden, so a faded-out logo is not focusable, clickable or announced — the three properties agree with each other in both states.
  - The two `flex: 1` spacers centre the link group while the logo keeps its layout slot, so revealing the logo does not shift the links.
  - `overflowX: 'auto'` with hidden scrollbars (`scrollbarWidth: 'none'` + the `::-webkit-scrollbar` rule) lets the five entries scroll horizontally between 860px and the point they fit.
  - Verdict: correct.

## Bugs found

None found.
