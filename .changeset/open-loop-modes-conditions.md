---
'@gemstack/ai-autopilot': minor
---

Add modes (Autopilot / Technical) to domain presets via `conditions` frontmatter (#244).

A preset content file can now ship mode variants: a `stem.<variant>.md` sibling
that declares `metadata.conditions` (a mode or list) overrides its `stem.md` base
when those modes are active. `loadDomainPreset(dir, { modes })` (and
`softwareDevelopmentPreset({ modes })`) resolve the winner per stem — the most
specific eligible variant, falling back to the base. The shipped Software
Development preset gains a `technical` variant of its major-change loop as an
illustration. This is the simple frontmatter fan-out; composing prompts from
parameters is the follow-up (#245).
