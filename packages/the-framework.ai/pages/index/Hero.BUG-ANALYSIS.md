# Bug analysis: packages/the-framework.ai/pages/index/Hero.tsx

## Business logic (high-level)

The landing page's opening screen and the site's package-manager mechanism. Four responsibilities:

1. **The pitch** — the three trust badges (100% Open Source / Free / Local), the struck-through "Babysit AI" over "Autonomous AI", the tagline, and the two "What is it?" / "Any software" blurbs. All strings match `Hero.SPEC.md` verbatim, including the parenthesised "(Semi-)autonomously".
2. **The primary call to action** — the terminal-styled `.try-box` holding the one-shot command, labelled `# One-shot (no install)`; clicking the command area copies it.
3. **The package-manager choice** — `PMS` is the single source of truth for all four variants; `pickPm` writes `html[data-pm]` plus `localStorage`, and `currentPm` reads it back. All four variants are pre-rendered into the HTML and CSS (`styles.css`'s `.pm-only-*` rules) shows exactly one. The choice is therefore global to the whole site (the go-to-dashboard page reuses `PMS`, `pickPm` and `currentPm`) and survives reloads via the `+Head` before-paint script — which is what makes the SPEC's "never sees an npm command flash first" true.
4. **The install shortcut** — the install chip *shows* `PMS[pm].install` but *copies* `${install} && the-framework`, per the SPEC's "Copying the install command also runs it".

Invariants and failure modes considered:

- **SSR/prerender safety.** The page is prerendered to static HTML; `currentPm()` touches `document` and is only ever called inside click handlers, never during render. The rendered markup is identical on server and client (all four variants always present, no `data-pm`-dependent React state), so hydration cannot mismatch. The `html:not([data-pm]) .pm-only-npm` rule keeps npm visible for a JS-disabled visitor.
- **No stale closures.** `PMS[currentPm()].try` is evaluated inside the handler, not captured at render time, so switching tabs and immediately clicking always copies the variant currently on screen. The tabs deliberately hold no React state — the active-tab styling is pure CSS off `html[data-pm]` — so the hero's tabs and the go-to-dashboard page's two tab rows stay in sync with zero synchronisation code.
- **Click targeting.** The copy handler sits on `.copy-box` (the command area), not on the whole `.try-box`, so clicking a `pm-tab` button switches the package manager without also copying. The `Badge` is `pointerEvents: 'none'`, so it can never swallow a click, and styles.css reveals it via `.try-box:has(.copy-box:hover) .try-badge` because it lives outside the hovered element.
- **`localStorage` denial.** `pickPm` wraps the write in `try/catch` (Safari private mode / storage-blocked contexts), and the `+Head` reader has its own `try/catch`; a failure degrades to "choice not remembered", never to a crash.
- **Unknown persisted value.** `currentPm()` validates with `p in PMS` and falls back to `npm`, and the `+Head` script whitelists the three non-npm values — so a hand-edited `localStorage.pm` cannot produce an undefined lookup (`PMS[currentPm()]` is always defined).
- **Command correctness.** `framework`'s sole bin is `the-framework`, which every one-shot runner resolves; the yarn row's npm install line is the SPEC's documented deliberate choice ("Yarn installs through npm on purpose"), with the rationale mirrored in the code comment.

## Functions (low-level)

- **`PMS`** — `as const` record of the four package managers, each with `try` and `install`. Used for the tab list (`Object.keys(PMS)`), the pre-rendered variants, and the copied text. Keys must stay in sync with the `.pm-only-*` / `.pm-tab-*` selector lists in styles.css and with the `+Head` whitelist; all three currently list npm/pnpm/bun/yarn. Verdict: correct (noted reliance).
- **`Pm`** — `keyof typeof PMS`. Correct.
- **`dollarStyle` / `commentStyle` / `cmdLineStyle`** — presentation constants. `dollarStyle`'s `userSelect: 'none'` keeps the `$` out of a hand-made selection of the command; `cmdLineStyle`'s `flexWrap: 'wrap'` lets the `# One-shot (no install)` comment drop to its own line on narrow screens. Verdict: correct.
- **`Badge({ label, copied })`** — the "copy"/"copied!" pill in the tab row. `label` and the `copied` class are driven by the same `tryCopy.copied` value at the call site, so they cannot disagree. Non-interactive (`pointerEvents: 'none'`, `userSelect: 'none'`). Verdict: correct.
- **`currentPm()`** — reads `document.documentElement.dataset.pm`, validates against `PMS`, defaults to `'npm'`. Browser-only; every caller is a click handler. `p in PMS` on a `string` is a safe guard here because `PMS` is a plain object literal — `'toString' in PMS` would be true via the prototype chain, but `dataset.pm` is only ever written by `pickPm` or the `+Head` whitelist, so no inherited key can reach it. Verdict: correct.
- **`pickPm(name)`** — sets the attribute (which instantly re-styles every command on the page through CSS) and mirrors to `localStorage` in a `try/catch`. Idempotent; no React state to desynchronise. Verdict: correct.
- **`Hero()`** — the component. Two independent `useCopy()` instances so the try-box badge and the install-chip tooltip have separate lifetimes (copying one does not flash the other). Both handlers pass the click event so `useCopy`'s double-click/selection guards work. Everything else is static markup. Edge cases: the `.try-box` has `maxWidth: '100%'` + `boxSizing: 'border-box'` and the command font-size clamps down to 11px, so the longest variant (`pnpm dlx framework`) fits a 320px viewport; the install chip uses `wordBreak: 'break-all'` for the same reason. Verdict: correct.

Cross-file note: the badge-timer flaw in `useCopy` (a second click within 1.5s lets the first timer clear the badge early) affects both copy targets here; it is recorded against `copy.ts`, where the fix belongs.

## Bugs found

None found.
