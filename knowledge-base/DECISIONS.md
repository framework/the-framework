# Decisions

- A skill's `SKILL.md` says only what an agent must know to use it right: each line
  stays only if an agent following the file would go wrong without it. The reasons
  behind a behavior, edge cases an agent never meets, and lists the command already
  states on stderr go. The reasons live in the package's `DECISIONS.md` and `LOGIC.md`.
  Why: a long skill file gets skimmed, and the rules that matter get missed. (#1838)
