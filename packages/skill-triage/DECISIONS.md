Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in LOGIC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## Commands
- Two kinds of skill: capability skills (`branches`, `tickets`, `queue`, `logs`), each a
  SKILL.md and a command, each saying how to do one thing; and command skills, each a
  SKILL.md only, each a job that composes capabilities. A command assumes no capability
  and names no skill; where the job is broken without a capability, it says so in
  capability words and stops. Picked over a command naming the capabilities it uses,
  which would tie the job to a package. A capability never names another skill.
- One package per command, `@gemstack/skill-<command>`, the SKILL.md at the package root
  like the capability skills. Picked over one package holding every command, so a project
  installs the commands it wants and nothing else; the name follows Claude Code's own
  convention, a command is a skill.
- A command is marked `disable-model-invocation`: a person or a runner fires it, the
  agent never picks it on its own.
- One triage command with a mode word, `/triage quick` and `/triage consensual`, and both
  modes when the word is missing; the schedule paces and switches each mode on its own
  line. Picked over two commands one sentence apart (the same job written twice), and
  over one line running both modes (significant work would then be queued wherever quick
  wins are, with no switch of its own).
- The command's words are the rules of the job, in numbers two runs agree on: a quick
  win is a planned ticket with effort 2 or less and uncertainty 2 or less; consensual
  work is a planned ticket with uncertainty 3 or less that is no quick win; a ticket on
  the queue, held, in review, or whose plan records a decision not to do the work is
  skipped; a quick win goes on the queue one above the ticket's priority, consensual
  work at the ticket's priority; only queue, never do, so a human can still veto on the
  queue. Picked over "low effort and no uncertainty" and "significant, consensual",
  which one run read as uncertainty 0 (never met) and another as uncertainty 3.
