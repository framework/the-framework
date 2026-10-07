What the tests cover, for the list to pick from and for naming a model:

- **The list** - with Claude Code listing `opus` ("Opus 5.5") and Codex unable to list ("not logged in"), the list is Claude Code with that one model, then Codex with none and the line "not logged in"; before the daemon answers, each coding agent comes with "Asking <coding agent>…".

- **A listed model** - `opus` in Claude Code's list is named "Opus 5.5".
- **The full id an alias runs** - `claude-opus-5-5`, the full id `opus` runs today, is named "Opus 5.5" too.
- **Named by its id** - a model the list does not hold (`fable`, or `claude-opus-5`, a full id no alias runs), a list not answered yet, and a coding agent that could not list its models all name the model by its id.
