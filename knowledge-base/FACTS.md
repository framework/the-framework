# Facts

- Each skill's `SKILL.md` exists twice: in its package (`packages/skill-<name>/SKILL.md`)
  and as the checkout copy under `.agents/skills/<name>/SKILL.md`. Nothing syncs or
  checks them; they are kept equal by hand and have drifted (the tickets copy lost a
  sentence in #1815). Change both in the same commit and diff them. (#1838)
