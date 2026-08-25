# Bug analysis: packages/the-framework.ai/pages/go-to-dashboard/+Page.tsx

## Business logic (high-level)

The `/go-to-dashboard` page: tells a visitor there is no hosted dashboard — it runs locally — and hands out three click-to-copy terminal routes: run `the-framework` (already installed), install globally, or one-shot run. Per its SPEC, the install and one-shot commands render in the visitor's chosen package manager (npm/pnpm/bun/yarn tabs), the same site-wide choice remembered across visits.

Invariants checked:

- **Command correctness.** The `framework` package (packages/framework/package.json) has a single bin named `the-framework`. So `the-framework` for the "Run" step is right; `PMS[pm].install` (`npm i -g framework` etc.) installs that bin; and every one-shot runner resolves a sole bin even when its name differs from the package name (npm's libnpmexec, pnpm dlx, bunx all do; yarn berry's dlx has an explicit `binaries.size === 1` fallback — verified in berry's `plugin-dlx/sources/commands/dlx.ts`). No wrong command is handed out.
- **PM choice plumbing.** Tabs call `pickPm` (from Hero) which sets `html[data-pm]` + localStorage; the visible variant is chosen purely by CSS (`.pm-only-*` rules in styles.css), and `resolve()` reads `currentPm()` at click time, so the copied text always matches the visible variant — no stale-closure risk. Both `PmSnippet`s (install and one-time run) share the global choice: clicking a tab above one snippet also flips the other and every other page — matches the SPEC ("the choice is the same one used everywhere else").
- **SSR safety.** The page is prerendered; all `document` access (`currentPm`) happens only inside click handlers. Prerendered HTML contains all four variants; the `+Head` before-paint script plus `html:not([data-pm]) .pm-only-npm` keep npm visible without JS, no FOUC.
- **Copy feedback.** `Cmd` reuses `useCopy`; the side tooltip (`copy-tip-side`) is hidden until hover/copied via styles.css, and the ≤760px media query repositions it above the chip with `!important` (beats the inline `tipStyle`). The `install-chip` class gives the hover background and makes `.install-chip:hover .copy-tip-side` match.

Failure modes considered: clipboard denial (handled in `useCopy`'s fallback), text selection (guarded in `useCopy`), very narrow screens (`wordBreak: 'break-all'`, tooltip repositioned). Nothing here maintains state of its own, so no lifecycle/concurrency concerns beyond `useCopy`'s (analyzed in copy.BUG-ANALYSIS.md — its stacked-timer flaw applies to these chips too).

## Functions (low-level)

- **`tipStyle`** — the side "copy/copied!" tooltip style; duplicate of the literal inline in Hero's install chip (DRY nit, not a bug). Correct.
- **`Cmd({ body, resolve })`** — click-to-copy chip. Renders `$ ` (non-selectable) + `body`; on click copies `resolve()` via `useCopy`, passing the event so double-click/selection guards work. `resolve` is evaluated at click time — correct for the PM-dependent commands. Edge: chip is a `span[onClick]` with no keyboard access (no tabindex/role) — consistent with every other copy target on the site; the command text remains selectable by hand. Verdict: correct.
- **`PmCmd({ get })`** — renders all four `get(pm)` variants in `.pm-only.pm-only-<name>` spans (CSS shows one), copies `get(currentPm())`. Relies on `PMS` keys and the styles.css `pm-only-*` selector list staying in sync (they are: npm/pnpm/bun/yarn). Verdict: correct.
- **`PmTabs()`** — four `.pm-tab.pm-tab-<name>` buttons calling `pickPm`; active styling is pure CSS off `html[data-pm]`, so both tab rows on this page (and the hero's) stay in sync automatically. Verdict: correct.
- **`PmSnippet({ get })`** — tabs stacked above their command. Verdict: correct.
- **`Step({ kicker, children })`** — kicker label + content section. Verdict: correct.
- **`Page()`** — TopNav, heading, the three Steps ("Run" → `the-framework`, "Install" → `PMS[pm].install`, "One-time run" → `PMS[pm].try`), Footer. Matches the SPEC's three routes exactly, including order. Verdict: correct.

## Bugs found

None found. (The `useCopy` badge-timer flaw that also affects these chips is recorded in pages/index/copy.BUG-ANALYSIS.md, where the fix belongs.)
