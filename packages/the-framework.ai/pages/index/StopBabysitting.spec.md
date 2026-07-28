"Stop babysitting" section (`#stop-babysitting`): data-driven problem cards, each contrasting "Bad fix" vs "Solution" rows.

## TLDR

- `PROBLEMS` — five problems (AI is lazy; Lazy AI plans; Lazy low-quality code; AI makes important decisions without asking; AI forgets), each with `bad()`/`good()` row factories setting emoji, label, and palette (`ROW_STYLES`).
- Solutions name real product mechanisms: divide-and-conquer subtasks, coverage checklists, critical-feedback/research/confidence loop, post-merge refactoring prompts queued at low priority, routine security/quality prompts when quota allows, confidence + variability self-gauging, knowledge retention in `knowledge-base/DECISIONS.md` / `INSIGHTS.md`.
- Layout: 280px/1fr card grid collapsing to one column <=860px, and 118px/1fr solution rows collapsing <=600px (`styles.css`).
- `Arrow` renders →/↔ in the mono font at 1.25em because the sans-serif glyphs are thin and vanish in muted body text (comment).
