Landing page (`/`) — all its sections plus the shared UI kit the other pages import.

## TLDR

- `+Page.tsx` — section assembly order.
- `Hero.tsx` — headline + PM-aware try/install copy boxes; exports the site-wide package-manager machinery (`PMS`, `currentPm`, `pickPm`).
- `SectionNav.tsx` — sticky scroll-spy nav with hash sync and back-to-top.
- `TopNav.tsx` / `Footer.tsx` — page chrome, shared with `/go-to-dashboard` and `/press`.
- `StopBabysitting.tsx` — problem cards ("Bad fix" vs "Solution" rows).
- `AutonomousAi.tsx` — autonomous PM/coding cards; `HowItWorks.tsx` — layout for `EnhancedSystemPrompt.tsx` + `Queues.tsx` with `Prompts.tsx` beneath; `Features.tsx` — feature grid; `YourFramework.tsx` — flexible/local/open-source cards; `Cta.tsx` — closing Discord/GitHub CTA.
- `ui.tsx` — design primitives (URLs, style constants, `SectionHead`, `Note`, `WipBadge`, `Emoji`, `CodeChip`); `copy.ts` — `useCopy` clipboard hook; `icons.tsx` — SVG icons; `styles.css` — global styles.

## Facts

- This directory doubles as the site's component library: subpages import `styles.css`, `TopNav`, `Footer`, `ui`, `copy`, and `Hero`'s PM machinery from here.
- The PM-choice contract spans four files: `+Head.tsx` (pre-paint `<html data-pm>` stamp from `localStorage`) ↔ `Hero.tsx` (`PMS`/`pickPm`/`currentPm`) ↔ `styles.css` (`html[data-pm]` visibility rules) ↔ `go-to-dashboard/+Page.tsx` (reuse) — all four command variants are prerendered; no React state.
- Styling is inline-style-first (dark palette hardcoded as hex: bg `#2d353b`, cards `#343f44`, fg `#d3c6aa`, green accent `#a7c080`, red `#e67e80`, yellow `#dbbc7f`); `styles.css` only holds what inline styles can't (hover, pseudo-elements, media queries, `data-pm` switching).
