# Bug analysis: packages/the-framework.ai/pages/index/HowItWorks.tsx

## Business logic (high-level)

The "How it works" section: a `SectionHead` ("The Framework introduces two major building blocks:") followed by the two building blocks side by side, then the `Prompts` band underneath. `HowItWorks.SPEC.md` demands exactly that composition and that order, and the code renders `EnhancedSystemPrompt` then `Queues` — the same order as the heading numbers ("1." and "2.", hard-coded in the children) and as the sub-heading's enumeration. A reordering here would silently contradict those numbers; that coupling is the only real invariant this file carries.

`id="how-it-works"` is one of `SectionNav.SECTIONS`' five ids, so this is a spy target and an anchor destination, and it uses the shared `sectionStyle` (margin-based rhythm, so `scroll-margin-top: 76px` lands on the heading).

No state, no props, no effects. The layout: the two blocks sit in `repeat(auto-fit, minmax(min(420px, 100%), 1fr))` with `alignItems: 'start'`, so below ~880px of available width they stack (each keeping its own height instead of being stretched), and the `min(420px, 100%)` guard prevents overflow on narrow viewports. The outer column uses a `clamp(44px, 8vw, 64px)` gap so the `Prompts` band is clearly separated from the two pillars — matching its "demoted band, not a third pillar" intent.

## Functions (low-level)

- **`HowItWorks()`** — the only export, no props, no branches. Composes `SectionHead`, the two-column grid (`EnhancedSystemPrompt`, `Queues`), and `Prompts`. Edge cases: none reachable — all children render unconditionally and take no props. Verdict: correct.

## Bugs found

None found.
