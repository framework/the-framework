The launcher's [1] "Context" picker: a dropdown at the start of the composer's control row, next to the Commands button, through which the user narrows the next agent's [2] focus to other registered projects and to specific files — the Context [3].

## Context

**User story**: the user wants the agent to work in this project with another project's code in mind, or on two particular files: the user opens "Context", ticks the other project, sees the files already picked, and presses Start. The agent's prompt names them on its last line.

## Glossary

[1] launcher: the Start form on a project's own page.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look.

## Business logic — TL;DR

- **The trigger** - reads "Context", followed by " · " and the launcher's summary ("2 projects · 1 file") when anything is picked; tooltip "Narrow the run to specific repos and files"; disabled while the launcher is busy.
- **Projects** - every registered project other than the current one, as a checkbox by name with its path as tooltip; the group's tooltip says "The agent can still reach every repo; ticking some just narrows its focus."; with no other project, "No other repos to add.".
- **Files** - the files picked through a `#` mention or the right rail's file tree, each with a remove cross (`ContextFiles.tsx`); with none, "None yet — add with # or the Files tab.".
- **One set** - ticking or unticking a project and removing a file both change the same Context the launcher keeps.

## Business logic

### The picker

#### Context

See `## Context`. The current project is the agent's own checkout, so it is not offered as something to add.

#### Business logic

The trigger reads "Context"; when anything is picked it adds " · " and the summary the launcher computes. Its tooltip is "Narrow the run to specific repos and files", and it is disabled while the launcher is busy.

The menu has two groups. "Projects" lists every registered project other than the current one as a checkbox by name, checked when its path is in the Context, with the project's path as its tooltip; the group's own tooltip states the rule: "The agent can still reach every repo; ticking some just narrows its focus.". With no other project registered it says "No other repos to add.". "Files" lists the picked files with a remove cross each, or says "None yet — add with # or the Files tab." when there are none. Ticking or unticking a project toggles its path in the Context; removing a file toggles it out.
