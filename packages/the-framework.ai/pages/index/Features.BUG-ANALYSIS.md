# Bug analysis: packages/the-framework.ai/pages/index/Features.tsx

## Business logic (high-level)

The "Features" section: eight cards in a responsive grid, one per capability. `Features.SPEC.md` enumerates exactly eight features in a fixed order — bring your own subscription, optimal quota usage, bring your own prompts, dashboard, notifications, Claude Code Web, swarm of local computers, Discord bot — and the rendered cards match that list one-for-one, in that order, with wording that carries each SPEC bullet's substance (own subscription/own installation; maximum daily usage while leaving room for manual prompts; save, re-use, share or keep private; the six dashboard items; browser and/or Discord notifications; 0% local CPU; multiple local computers; Discord bot for team conversations).

`id="features"` is one of the five ids in `SectionNav.SECTIONS`, so this section is a scroll-spy target and an anchor destination; it uses the shared `sectionStyle` (vertical rhythm as *margin*, not padding) so `scroll-margin-top: 76px` lands the heading just under the sticky nav rather than a screen of padding below it.

No state, no effects, no props, no user input — nothing to race, leak, or go stale. The grid is `repeat(auto-fit, minmax(min(300px, 100%), 1fr))`: the `min(300px, 100%)` guard is what keeps a 300px minimum from overflowing viewports narrower than 300px, so the eight cards collapse to a single column cleanly.

Content-vs-product check: three of the eight cards (Claude Code Web, swarm of local computers, Discord bot) describe capabilities that the root `FEATURES-SPEC.md` does not list as shipped, and unlike `YourFramework`'s "Customize anything to fit your needs" they carry no `WipBadge`. Since `Features.SPEC.md` — the intent source for this file — specifies all eight cards as plain feature cards with no "Coming soon" marker, this is a deliberate product decision about the marketing site, not a code defect; recorded here as a reliance on that SPEC.

## Functions (low-level)

- **`featureCardStyle`** — module constant spreading `cardStyle` plus padding and a column flexbox. Each card then spreads it again with its own `gap` (12 everywhere except the Dashboard card's 14), so the per-card override cannot clobber the shared look. Verdict: correct.
- **`FeatureText({ children })`** — muted 14.5px paragraph wrapper; `margin: 0` prevents the browser's default `<p>` margin from breaking the card's flex `gap` rhythm. Inputs: arbitrary `ReactNode`, always plain text here. Verdict: correct.
- **`Features()`** — the section. Eight hand-written cards rather than a data array: verbose, but each card's copy is prose with its own em-dashes and quotes, so there is no key/index logic that could go wrong and no possibility of a duplicate/missing React key. Edge cases: none — no conditionals, no data. Verdict: correct.

## Bugs found

None found.
