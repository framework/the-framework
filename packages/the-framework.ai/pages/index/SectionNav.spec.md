Sticky scroll-spy section nav for the landing page ("On this page" bar with the five section links).

## TLDR

- `SECTIONS` — the five section ids/titles; "Your framework" renders with an italic *Your* (`italicFirst`).
- Scroll handler (passive): the last section whose top crosses the spy line — `max(130, 55% of viewport height)` — is active; within 120px of the page bottom (the closing `Cta` screen) nothing is highlighted.
- Keeps `location.hash` in sync with the active section via `history.replaceState` (no scroll jumps, no history spam).
- `stuck` (bar top <= 0) drives the translucent blurred background, the border swap, and a fade-in back-to-top logo that keeps its layout slot so links never shift; when unstuck the logo is `aria-hidden` and untabbable.
- Whole nav is hidden below 860px (`styles.css`).

## Decisions

- Plain `position: sticky`: the design export faked sticky with a spacer + `position: fixed` because its runtime wrapper broke sticky; without that wrapper plain sticky works (comment).
- Spy line at ~55% viewport: eager enough to follow the reader without flipping while a title still hugs the bottom edge; nav clicks land content at y=76 (`scroll-margin-top: 76px` in `styles.css`), inside the line.
