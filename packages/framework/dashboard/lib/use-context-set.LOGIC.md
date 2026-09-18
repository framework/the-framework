Holds the Context [1] the user picked to focus the next agent [2] on, so the launcher's [3] own picker and the right rail's file tree are two views of one selection and can never disagree about what is picked; and turns the prompt and the Context into the one prompt a Start sends.

## Context

**User story**: the user ticks another registered project in the launcher's "Context" menu, `#`-mentions a file in the prompt, clicks a second file in the right rail's file tree, and presses Start. The agent's prompt ends with one line naming the project's path and the two files, so the agent knows where to look. The next launch starts with nothing picked.

**Problem**: the project's start hook [4] is handed one prompt and nothing else, so the Context has to travel as words in that prompt. A command's prompt must begin with `/<command>` for the coding agent [5] to run it as a command, so the Context cannot go at the head.

## Glossary

[1] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] launcher: the Start form on a project's own page.
[4] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`, which starts an agent and answers its id.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] composer: the prompt editor on a project's own page, also used to say something to an agent.
[7] project: a repository the user registered in the dashboard, identified by an id derived from its path.

## Business logic — TL;DR

- **One set, three edits** - a path can be added, removed or toggled; adding a path already in the set changes nothing, so the same file picked twice is picked once.
- **Cleared when it stops applying** - the set is emptied when the selected project [7] changes, when an agent is started, and when the sidebar's "New" is pressed.
- **The Context in the prompt** - a non-empty Context is appended to the prompt as one `Context: <paths>` line after a blank line; an empty one leaves the prompt as typed.

## Business logic

### One set, three edits

#### Context

See `## Context`.

#### Business logic

The set starts empty. Adding a path already in it changes nothing. Removing a path not in it changes nothing. Toggling adds a path that is absent and removes one that is present. Removing is what a deleted mention chip in the composer [6] does, which keeps the prompt text and the picked set from drifting apart; toggling is what a project's checkbox, a file's remove cross and a click in the file tree do.

### Cleared when it stops applying

#### Context

**Problem**: the files in the set are paths inside one project, and the set was meant for one Start.

#### Business logic

The shell (`App.tsx`) empties the whole set: whenever the selected project [7] changes, including when Back or Forward changes it; when an agent is started or an ended one is continued, because the picked Context went with that start; and when the user presses "New" in the sidebar, even while staying in the same project.

### The Context in the prompt

#### Context

See `## Context`.

#### Business logic

With an empty Context the prompt is sent exactly as typed. Otherwise the prompt's trailing whitespace is removed, then a blank line, then one line `Context: ` followed by every path in the set, in the order they were picked, joined by ", ". For example `/research src` with one other project and one file becomes `/research src`, a blank line, and `Context: /repos/other, README.md`. The line goes at the end so a command's `/<command>` still leads the prompt.
