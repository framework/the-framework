# Bug analysis: packages/the-framework.ai/pages/index/ui.tsx

## Business logic (high-level)

The website's shared kit: the three outbound URLs, the design tokens (`mono`, `sectionStyle`, `h2Style`, `h3Style`, `cardStyle`, `kickerStyle`, the note styles) and five small components (`SectionHead`, `Note`, `WipBadge`, `Emoji`, `CodeChip`). Per `ui.SPEC.md` its job is that every page draws from one set of destinations and one set of visual pieces, and that emoji come from shipped SVGs rather than the visitor's emoji font.

Invariants that actually carry weight:

- **One source of truth for the three exits.** `DISCORD_URL`, `GITHUB_URL`, `NPM_URL` are consumed by `TopNav`, `Footer`, `Cta` and `/press`; the Discord invite is also hard-coded once more in `pages/press/+Page.tsx` (`https://discord.gg/qc8zvdzWNR`), which is a duplication that could drift — recorded in that file's analysis.
- **The rhythm is a margin, not padding.** `sectionStyle` uses `margin: clamp(72px,13vw,140px) auto 0`, deliberately, so that `section[id] { scroll-margin-top: 76px }` lands a nav click on the section's heading rather than a screen of empty padding. Changing it to padding would silently break every anchor and the scroll-spy's mid-line rule at once.
- **Emoji assets must exist.** `EMOJIS` maps eight characters to `/assets/emoji-<name>.svg`; all eight files are present in `packages/the-framework.ai/public/assets` (flex, mech-arm, compass, robot, hand-raised, confused, rocket, construction). `EmojiChar = keyof typeof EMOJIS` makes an unmapped emoji a type error rather than a broken image, and `EMOJIS[e]` cannot be `undefined` under `noUncheckedIndexedAccess` because the key is `keyof`.
- **`CodeChip` must survive both surfaces.** It carries an explicit border because its `#232a2e` background disappears on the "good solution" rows in `StopBabysitting`, which share that color; `overflowWrap: 'anywhere'` + `boxDecorationBreak: 'clone'` keep long paths (`knowledge-base/DECISIONS.md`, `conversations/<DATE>_<TOPICS_SLUG>.md`) inside their card on mobile with the border repeated on each fragment; `fontStyle: 'normal'` keeps it upright inside the italic `Note` body.

No state, no effects, no DOM access, no async — nothing to leak or race. All of it is prerender-safe.

## Functions (low-level)

- **`DISCORD_URL` / `GITHUB_URL` / `NPM_URL` / `mono`** — constants. Correct.
- **`sectionStyle`, `h2Style`, `h3Style`, `cardStyle`, `kickerStyle`, `noteContainerStyle`, `noteLabelStyle`** — shared style objects, spread (never mutated) by consumers, so sharing one object per token is safe. Every consumer that overrides a key spreads the token first, so no override is silently lost. Correct.
- **`SectionHead({ title, sub })`** — centered heading + accent bar + optional sub. `title` is `ReactNode` (YourFramework passes JSX); `sub` is `string | React.ReactNode`, a redundant union but harmless — the `React` namespace is used only in type position, which is legal for the UMD global in a module. `{sub && …}` renders nothing for `undefined`; the only falsy value a caller could pass is `''`, which no caller does (and which would render nothing — the desired outcome anyway). The accent bar is `aria-hidden` and purely decorative. Verdict: correct.
- **`Note({ children, style, label })`** — the note `<p>`: label (defaulting to the "Note" pill) then the italic body. `{...noteContainerStyle, ...style}` puts the caller's overrides last, so `AutonomousAi`'s flex sizing adds to the look rather than replacing it. `label ?? <span>Note</span>` only substitutes for `null`/`undefined`, so a caller cannot accidentally erase the label with `''`… except by passing `''` deliberately, which nothing does. Because it renders a `<p>`, children must be phrasing content — the one block-level case (the prompt-pack chip row) correctly bypasses this component and reuses the styles directly. Verdict: correct.
- **`WipBadge({ style, icon = true })`** — the "Coming soon" pill, optionally preceded by the 🚧 emoji. `fontStyle: 'normal'` un-italicises it inside a `Note`; `whiteSpace: 'nowrap'` keeps the two words together. The `...style` spread is last, so callers can override anything. The badge's text is written on its own indented JSX line, which JSX trims to exactly "Coming soon" (the leading characters are ordinary spaces, verified byte-wise — not a non-breaking space that would survive trimming). Verdict: correct.
- **`EMOJIS` / `EmojiChar`** — the eight-entry map and its key type. Verdict: correct.
- **`Emoji({ e, style })`** — an `<img>` at `height: 1em` with a `-0.12em` baseline nudge, `alt={e}` (the emoji character itself). `alt` being the emoji means screen readers announce it wherever the wrapper is not `aria-hidden` (e.g. `StopBabysitting`'s row labels) — an a11y wrinkle at the call sites, and the alternative (`alt=""`) would be wrong for the CTA headline where the emoji is content. Sizing by `1em` means the eight SVGs must be square-ish; they are Noto's own squares. Verdict: correct.
- **`CodeChip({ children, fontSize })`** — described above; `children` is typed `string`, which is what forces every call site to pass a single literal (so `overflowWrap` behavior is predictable). Verdict: correct.

## Bugs found

None found.
