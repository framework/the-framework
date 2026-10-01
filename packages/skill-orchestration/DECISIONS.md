Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in the LOGIC.md files; a choice made while implementing is the implementer's judgment,
not a decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## Orchestration as a skill
- A main agent runs subagents through a skill with a thin command of its own,
  `orchestration` (`start`, `list`, `read`, `stop`), in a package that depends on the
  runner. Picked over more commands on `agent-runner` (the runner names no skill, and
  would grow commands only a skill uses) and over a skill file alone (listing and
  stopping need the runner's mark and a pid, which no command prints to an agent).
- The words are main agent and subagent. Picked over coordinator and worker.
- The package and its command are named `orchestration`. Picked over `subagents` and
  `agents`.

## A subagent
- A subagent's branch starts from the main agent's branch, not from origin's default
  branch: it works on what the main agent already committed.
- A subagent starts no subagents. Picked over a tree of any depth.
- What every subagent must be told (commit to its branch, open no pull request, ask
  nobody) is added to its task by the command. Picked over the skill file asking the
  main agent to write it into every task: a rule that lives only as prose is forgotten.
- Until a setting says which models subagents use, a subagent runs on the main agent's
  coding agent and that coding agent's default model, unless the main agent's own task
  names another.
