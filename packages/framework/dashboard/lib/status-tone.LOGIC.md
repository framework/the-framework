Fixes the one color vocabulary for an agent's [1] status word, so the same status can never read as two colors in two places: a running agent is drawn in the accent color, one that finished in the success color, one that was stopped [2] in the warning color, and one that failed in the danger color. Every list that shows a status reads it from here — the rail of agents and a project's own list of them — and a status outside these four is left uncolored rather than given a color of its own.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] stop: ending an agent before it finishes: the Stop button or Ctrl-C.
