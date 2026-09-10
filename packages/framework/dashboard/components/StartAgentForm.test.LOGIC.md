What the tests cover, for the launcher on a project home [1]:

- **Preset or typed prompt** - text loaded from a preset [2] starts a prompt agent [3] marked unattended [4], so it ends when its work settles [5] and its armed handoff [6] fires; text the user typed starts a build agent [3] that is left attended, so it stays open for live chat [7].
- **Pre-flight is shown, never enforced** - a coding agent [8] that is not logged in is named above the Start together with the command that fixes it; a daemon running as root is shown as a warning that does not claim the start will fail; a coding agent with nothing wrong shows no line at all.
- **Pre-flight is asked per coding agent** - switching the driver [9] from Claude Code to Codex asks the question again, because one being logged in says nothing about the other.
- **The GitHub CLI half is asked for only when it matters** - the check includes the GitHub CLI while the handoff [6] reaches the pull request rung, and leaves it out for a push-only handoff.
- **A GitHub Actions agent is not gated on this machine** - an agent [10] whose location [11] is `actions` is never pre-flighted against a local coding agent it will not use.
- **The Haiku warning teaches and never blocks** - choosing Haiku shows the warning that a publishing agent ends as an unmerged draft pull request, while the Start stays available; any other model shows nothing.
- **The auto-merge notice** - an armed merge on a repository that disallows GitHub auto-merge says the daemon merges on green instead and names the server-side setting to enable, without blocking the Start; a repository that allows auto-merge, and one the GitHub CLI cannot speak for, show nothing; an unarmed merge never asks the question at all.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[2] preset: a canned prompt the user launches from the dashboard.
[3] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[4] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[5] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[6] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local`, `push`, `pr` (the default) and `merge`.
[7] live chat: the user's own messages to a running agent, each continuing the same driver session.
[8] coding agent: the CLI doing the actual work: Claude Code or Codex.
[9] driver: a coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`.
[10] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[11] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
