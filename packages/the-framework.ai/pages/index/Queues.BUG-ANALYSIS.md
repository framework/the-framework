# Bug analysis: packages/the-framework.ai/pages/index/Queues.tsx

## Business logic (high-level)

Building block 2 of "How it works": the two queues, as two cards.

- **AI Queue** — upcoming AI tasks, added by humans or by agents themselves (autonomously when there is no uncertainty, otherwise after human confirmation); the claim that agents populating it is what makes the AI autonomous; and the deflating technical footnote that it is just a `TODO_AGENTS.md` file in the user's Git repositories.
- **Human Queue** — pending human reviews, filled when agents need the user to settle important decisions with subtle pros and cons; framed as the user's cockpit that keeps humans in control.

Both cards carry every point `Queues.SPEC.md` makes, in the SPEC's order, and the two emphasis phrases ("makes AI autonomous", "It's your cockpit") are the ones the SPEC singles out. Static content: no state, no effects, no user input, nothing to race.

Layout: `repeat(auto-fit, minmax(min(280px, 100%), 1fr))` collapses the two cards to one column on narrow screens without overflowing (the `min(…, 100%)` guard). `TODO_AGENTS.md` goes through `CodeChip`, whose `overflowWrap: 'anywhere'` + `boxDecorationBreak: 'clone'` keep the long token from overflowing the card and keep the chip's border on every wrapped fragment. The section is `id="queues"`, nested inside `#how-it-works` and absent from `SectionNav.SECTIONS`, so it cannot interfere with the scroll-spy.

## Functions (low-level)

- **`leadStyle`** — the emphasis run's color/weight; shared object, never mutated. Correct.
- **`P({ children })`** — muted 14px paragraph with `margin: 0` so the card's flex `gap` is the only vertical rhythm. Correct.
- **`QueueCard({ title, icon, children, style })`** — card shell: `cardStyle` + padding + column flex, an `<h4>` with the title and an `aria-hidden` emoji span, then the children. Two things worth flagging as smells rather than defects: (a) the prop named `style` is applied to the *emoji span*, not to the card — it is only ever used to nudge `verticalAlign`, and both call sites pass exactly that, so nothing is mis-styled; (b) `verticalAlign: 0` on the Human Queue card is a no-op (baseline is the default) — React serialises the numeric `0` without a unit, which is valid CSS. `icon` is typed `EmojiChar`, so an emoji missing from `ui.tsx`'s `EMOJIS` map cannot be passed (it would be a type error, not a broken `<img>`); both `🤖` and `🙋` are in the map and their SVGs exist in `public/assets`. The heading level jumps from the section's `<h3>` to `<h4>` correctly. Verdict: correct.
- **`Queues()`** — the section: `<h3>2. Queues</h3>` plus the two `QueueCard`s. The "2." is hard-coded and depends on `HowItWorks` rendering `EnhancedSystemPrompt` ("1.") first — it does. Edge cases: none reachable. Verdict: correct.

## Bugs found

None found.
