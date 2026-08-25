# Bug analysis: packages/the-framework.ai/pages/index/StopBabysitting.tsx

## Business logic (high-level)

The problem statement of the pitch: five problem cards, each pairing the "Bad fix" people reach for with one or more "Solution" rows. The content is a module-level `PROBLEMS` array rendered generically, so the structure cannot drift between cards.

Checked against `StopBabysitting.SPEC.md`, problem by problem: *AI is lazy* (bad: "DON'T BE LAZY"; solutions: divide-and-conquer, coverage guarantees), *Lazy AI plans* (bad: tell it to deep dive; solution: the automatic loop), *Lazy low-quality code* (bad: "WRITE CLEAN CODE"; solutions: post-merge refactoring prompts at low priority, routine security/quality passes when quota allows), *AI makes important decisions without asking* (bad: "research alternatives"; solutions: self-gauge confidence, self-gauge plan variability), *AI forgets* (bad: repeating yourself; solution: `knowledge-base/DECISIONS.md` / `knowledge-base/INSIGHTS.md`). Every SPEC bullet is present, in the SPEC's order, and only the fifth pair adds a `desc`, which the SPEC does not forbid. One word deviates from the SPEC's wording: the loop row is rendered as "critcal feedback" (see Bugs found).

Static content, no state, no effects, no user input, no async — no ordering, race or leak concerns. The card grid is `280px 1fr`, flattened to a single column by the `.problem-card` rule at ≤860px; each row is `118px 1fr`, flattened at ≤600px by `.solution-row`. Both rules need `!important` because the base `gridTemplateColumns` are inline styles — they have it.

The `knowledge-base/*.md` paths render through `CodeChip` (`overflowWrap: 'anywhere'`), so they cannot overflow the row on a narrow screen; the good rows' `#232a2e` background is exactly why `CodeChip` carries a border (noted in `ui.tsx`).

## Functions (low-level)

- **`ROW_STYLES`** — `bad`/`good` palettes, `as const`; indexed by `r.kind`, which is typed `keyof typeof ROW_STYLES`, so the lookup can never be undefined. Verdict: correct.
- **`Arrow({ glyph })`** — renders `→` or `↔` in the mono face at 1.25em so the glyph does not vanish in the muted body text. `glyph` is a literal union, so no unexpected character can reach it. Verdict: correct.
- **`bad(body)` / `good(body)`** — row factories fixing `kind`, `emoji` and `label`; they are what keeps every "Bad fix"/"Solution" label and icon identical across the five cards. Both emoji (`😕`, `🚀`) exist in `ui.tsx`'s `EMOJIS` and as SVGs in `public/assets`. Verdict: correct.
- **`PROBLEMS`** — five entries; `title` is unique across them, so `key={p.title}` is stable and collision-free. `rows` use `key={i}`, which is fine for a static, never-reordered list. `body` is `ReactNode`, so both plain strings and JSX fragments are valid. Verdict: correct.
- **`StopBabysitting()`** — the section (`id="stop-babysitting"`, the first `SectionNav` target, using the shared `sectionStyle`). Maps `PROBLEMS` to cards and `p.rows` to rows; `p.desc` is rendered only when present. The row label span is not `aria-hidden`, so screen readers announce the emoji's alt text ("😕") before "Bad fix" — an a11y wrinkle shared with the rest of the site's `Emoji` usage, not a defect in this file's logic. Edge cases: an empty `rows` array would render an empty column, but the data is a module constant. Verdict: correct.

## Bugs found

1. `L47`: **"critcal feedback" is a typo in user-facing landing-page copy.** The "Lazy AI plans" solution row renders "Automatic loop of critcal feedback ↔ research ↔ confidence ↔ implementation" — `StopBabysitting.SPEC.md` specifies "an automatic loop of critical feedback, research, confidence check and implementation". Any visitor reading the problem section sees the misspelling in the middle of the product's core claim. Severity: minor (cosmetic, but on the site's most-read section). Fix: `critcal` → `critical`.
