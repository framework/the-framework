# Bug analysis: packages/the-framework.ai/pages/index/TopNav.tsx

## Business logic (high-level)

The site-wide header, rendered by all three content pages: logo + "The Framework" on the left, Discord and GitHub buttons on the right. Three specified behaviors from `TopNav.SPEC.md`:

- **The logo goes home.** `<a href="/">` — on a subpage it navigates normally; on the landing page itself `goHome` cancels the navigation and instead drops the section anchor from the URL and smooth-scrolls to the top. That avoids a full re-render/reload of the page the visitor is already on.
- **Right-clicking the logo opens the press page.** `onContextMenu` suppresses the native menu and navigates to `/press`. Deliberate per SPEC (someone reaching for "Save image as…" is exactly the person who wants the press kit). It also fires on a long-press on touch devices, which lands the same visitor in the same place.
- **No Dashboard button.** The header links only to Discord and GitHub; the code carries the rationale (the dashboard is a local daemon a public page can neither reach nor detect) with issue references.

Correctness of the two handlers:

- `goHome` is a no-op guard (`return` without `preventDefault`) whenever `location.pathname !== '/'`, so `/press` and `/go-to-dashboard` get a plain link home — which Vike's Client Routing then turns into a client-side navigation. On `/`, `history.replaceState(null, '', pathname + search)` clears only the hash and preserves any query string; Vike's monkey-patched `replaceState` re-attaches its own `state.vike` payload, so passing `null` does not destroy the router's scroll-restoration data. The subsequent `scrollTo({ behavior: 'smooth' })` is not fought by the SectionNav spy: as the page approaches the top no section qualifies, so the spy converges on the same empty hash rather than re-adding one.
- `onContextMenu` uses `window.location.href = '/press'` (a hard navigation) rather than a router navigation — correct and simplest here, since a context menu is not a link click Vike could intercept.

No state, no effects, no timers — nothing to leak or go stale. The nav wraps (`flexWrap: 'wrap'`, `rowGap: 14`) and the `@media (max-width: 480px)` rules in styles.css hide the button labels (`.nav-btn span`) leaving icon-only buttons, which is why each label is wrapped in its own `<span>`.

## Functions (low-level)

- **`navBtnStyle`** — shared button style object for both anchors; never mutated, safe to share. Its inline `color` is why `.nav-btn:hover` in styles.css needs `!important`. Verdict: correct.
- **`goHome(e)`** — described above. Edge cases: on `/` with no hash it still calls `replaceState` (harmless, URL unchanged) and smooth-scrolls to top (a no-op when already there). Browser-only code inside an event handler, so prerendering is unaffected. Verdict: correct.
- **`TopNav()`** — the header. The logo `<img>` has a real `alt` ("The Framework logo") since the anchor is a link, and the two icons are `aria-hidden` inside anchors whose `<span>` text labels them — but note those labels are `display: none` at ≤480px, leaving the icon-only buttons unlabelled for screen readers on small screens (a11y wrinkle, no functional impact). Both destinations come from `ui.tsx`, so header/footer/CTA cannot drift. Verdict: correct.

## Bugs found

None found.
