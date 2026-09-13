Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in LOGIC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## Routines
- Two kinds of skill: capability skills (`branches`, `tickets`, `queue`, `logs`), each a
  SKILL.md and a command, each saying how to do one thing; and routine skills, each a
  SKILL.md only, each a job that composes capabilities. A routine names the capabilities
  it uses; a capability never names another skill. Picked over shipping a routine inside
  the capability package it mostly uses (the queue's), which would make that package know
  about tickets.
- Routines are their own package, SKILL.md files only, under `skills/<name>/`. Picked over
  the framework package's own `skills/` folder, so a project can install the routines
  without the daemon and can replace one with its own; and over one package per routine,
  which gains nothing while every routine is a single file.
- A routine is marked `disable-model-invocation`: a person or a daemon fires it, the
  agent never picks it on its own.
- The daemon fires a routine by its name, `/work-queue`; the agent's harness expands the
  skill. The routine's words are the rules of the job — one task, commit but do not push,
  committed counts as published, say so and stop when nothing is queued — never a skill's
  name or command.
