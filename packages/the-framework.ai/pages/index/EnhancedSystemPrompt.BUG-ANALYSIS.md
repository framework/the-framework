# Bug analysis: packages/the-framework.ai/pages/index/EnhancedSystemPrompt.tsx

## Business logic (high-level)

Building block 1 of "How it works": the card explaining that The Framework appends a system prompt which makes the agent follow effective practices, with a four-item checklist and a note that the prompt is customizable or can be opted out of entirely.

Checked against `EnhancedSystemPrompt.SPEC.md` item by item: the lead sentence names both examples the SPEC names (dividing large work into subtasks, listing significant alternative solutions); `ITEMS` is exactly the SPEC's four summary bullets in the SPEC's order (Anti-laziness, No important decisions without asking, Improved user interaction, Improved planning); the closing `Note` carries the customize/opt-out sentence. No content drift.

Static content, no state, no effects. Structural concerns:

- It renders a `<section id="enhanced-system-prompt">` nested inside `HowItWorks`'s `<section id="how-it-works">`. Nested sections are valid HTML, and the nested id is not in `SectionNav.SECTIONS`, so the scroll-spy never looks at it — no chance of it stealing the highlight from its parent. The `section[id] { scroll-margin-top: 76px }` rule in styles.css applies to it harmlessly (nothing links to `#enhanced-system-prompt`).
- The `<h3>` uses the shared `h3Style`, matching `Queues`'s heading, so the two side-by-side blocks align typographically. Both are grid items of `HowItWorks`'s `auto-fit` grid with `alignItems: 'start'`, so unequal heights don't stretch either card.
- The heading number "1." is hard-coded here and "2." in `Queues.tsx`; the ordering is enforced only by `HowItWorks` rendering them in that order (it does, in the sub-heading's enumeration order). Noted as a reliance, not a defect.

## Functions (low-level)

- **`ITEMS`** — module-level array of four strings, used as both content and React `key`. All four are distinct, so keys are unique; the list is static, so key-by-value is stable across renders. Verdict: correct.
- **`EnhancedSystemPrompt()`** — the only export, no props. Renders heading (with the `🧭` emoji, present in `ui.tsx`'s `EMOJIS`; `public/assets/emoji-compass.svg` exists), lead paragraph, `<ul>` of `<li>` rows with a green ✓ marker, and the `Note`. The `aria-hidden` span around the emoji suppresses the decorative compass for screen readers — correct, unlike the emoji in `StopBabysitting`'s row labels, which are announced. The ✓ marker span has no fixed width (unlike `YourFramework`'s `Item`), so a wrapped item's second line starts under the ✓ rather than under the text; the four items are short and don't wrap at any supported width, so no visible defect. Edge cases: `ITEMS` is never empty and never user-supplied. Verdict: correct.

## Bugs found

None found.
