Starting an agent [1] from the dashboard, the same way on every surface that does it: the launcher [2], the tickets' buttons, the agent queue's button, the onboarding checklist. It sends the start, tracks that one is in flight, and turns a refusal into words the surface shows.

## Context

**User story**: the user presses a button that starts an agent. While the start is in flight the button is busy; when it is refused the reason appears beside it; when it works the dashboard opens the agent that was started.

**Problem**: the daemon runs no agent itself. A start is the project's start hook [3], which may refuse for reasons only the tool it names knows (the coding agent is not installed, the command does not exist). Every surface must show those words as they came, and none should rebuild the busy-and-error handling for itself.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] launcher: the Start form on a project's own page.
[3] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`. The daemon runs it with the prompt and the user's picks in its environment, and the line answers the id of the agent it started.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`).
[6] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[7] follow-up: a prompt a start carries besides its own: once the agent ends done with a pull request, the tool the start hook names starts a fresh agent on the same branch with that prompt and the first agent's id, and holds the pull request's merge until that one is done.

## Business logic — TL;DR

- **What a start sends** - the project, the prompt, and the options: the user's picks, the launcher's follow-up [7] when its box is ticked, and a device [6] when the launcher picked one.
- **The user's picks** - the coding agent [4] and the model from the preferences [5]; one that was never picked is left out, so the start hook's own default applies.
- **The post-merge cleanup pick** - offered only where the project has the `post-merge-cleanup` command; with the preference on there, the start's follow-up [7] is `/post-merge-cleanup`.
- **A refusal keeps its own words** - the reason the daemon answered, or the surface's fallback wording when there is none.
- **How the started agent is selected** - a successful start answers the started agent's id, and the dashboard opens that agent.

## Business logic

### What a start sends

#### Context

See `## Context`.

#### Business logic

A start names the project, carries the prompt as typed or as the surface composed it (a command such as `/update-tickets`), and carries the options. There is one kind of start: a command, a saved prompt and the user's own words are all one prompt to the project's start hook [3]. While a start is in flight the surface reads as busy.

### The user's picks

#### Context

**Problem**: a start from a ticket's button should run on the same coding agent [4] and model as one from the launcher [2], without each surface reading the preferences [5] its own way.

#### Business logic

The picks are read off the preferences: the coding agent when the user picked one, the model when the user picked one. One that was never picked is not part of the start at all, so the project's start hook applies its own default rather than being handed a value nobody chose. Every surface that starts an agent sends these same picks; the launcher adds the picked device [6].

### The post-merge cleanup pick

#### Context

**User story**: the user ticked "Post-merge cleanup" in the launcher [2]; every start from it is followed by a fresh agent running `/post-merge-cleanup` on the first agent's branch before its pull request merges.

#### Business logic

The project offers the post-merge cleanup when one of its commands is named `post-merge-cleanup`. The start's follow-up [7] is `/post-merge-cleanup` when the preferences [5] say `postMergeCleanup` is on and the project offers it; otherwise the start carries no follow-up. The command's id is never added here: the tool the start hook [3] names appends the first agent's id. Only the launcher adds this pick; the tickets' buttons, the agent queue's button and the onboarding checklist start with no follow-up.

### A refusal keeps its own words

#### Context

See `## Context`.

#### Business logic

A refused start shows the reason the daemon answered: the start hook's own last line ("the start hook: …"), "this project has no start hook", "a non-empty prompt is required", an unknown project, or that the device could not be reached. A start that failed without any reason shows the surface's own fallback, "Failed to start the agent." unless the surface gave another. The error stays until the surface clears it or starts again.

### How the started agent is selected

#### Context

**Problem**: several agents run at once, so "the running one" does not say which agent a start just made.

#### Business logic

A successful start answers the id of the agent the start hook began. The surface hands that id to the shell, which opens exactly that agent. A refused start answers nothing, and the surface stays where it is.
