Says how a tool call [2] of the coding agent [3] reads in an agent's [1] transcript: a verb and what it was done to ("Read AGENTS.md", "Ran pnpm test"), and how several calls sum up in one line ("Ran 2 commands, read 1 file").

## Context

**User story**: the user reads what the coding agent did between two of its messages as short plain lines, the way Claude Code on the web writes them, and reads the same lines whether the agent is Claude Code or Codex.

**Problem**: both coding agents report a call as a label and a detail, but the labels differ. Claude Code's label is the tool's name ("Bash", "Read", "Edit"). Codex's label is the kind of the thing it did ("commandExecution", "fileChange"). Neither is a word a reader wants to read.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] tool call: one use of a tool by the coding agent (running a command, reading a file, editing a file, searching), reported as a label and, when the call has one, a detail: the one argument that says what it did (the command, the file, the address), on one line and cut short.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **One call as a verb and a target** - the label picks the verb, its form for a call still going on, and the kind of the call; the detail is the target, a file reading as its name alone.
- **Several calls as counts** - each kind counted, in the order the kinds first came.

## Business logic

### One call as a verb and a target

#### Context

See `## Context`.

#### Business logic

The label picks the verb, the verb's form while the call is still going on, and the kind of the call [2]:

| Label (Claude Code) | Label (Codex) | Verb | While going on | Kind |
| --- | --- | --- | --- | --- |
| Bash | commandExecution | Ran | Running | command |
| Read | | Read | Reading | read |
| Edit, MultiEdit, NotebookEdit | fileChange | Edited | Editing | edit |
| Write | | Wrote | Writing | edit |
| Grep, Glob | | Searched | Searching | search |
| WebSearch | webSearch | Searched the web | Searching the web | search |
| WebFetch | | Fetched | Fetching | other |
| Skill | | Used skill | Using skill | other |
| Task, Agent | | Started agent | Starting agent | other |
| TodoWrite | | Updated todos | Updating todos | other |
| | mcpToolCall | Called | Calling | other |

A label not in the table is its own verb, in both forms, of the kind "other": a label written as one camel-case word, as Codex's kinds are, reads as words with a capital first ("imageView" reads "Image view"), and any other label reads as it is.

The target is the detail. For a read and for an edit, the target is the file's name alone, the last part of the path; when the detail names several files, separated by a comma and a space as Codex names the files of one change, each is cut to its name. The detail is kept whole beside the target, for a reader who opens the call. A call with no detail has no target.

### Several calls as counts

#### Context

See `## Context`.

#### Business logic

A list of calls reads as one line: each kind's count, in the order the kinds first came in the list, separated by a comma and a space, with a capital first. A command counts as "ran N command(s)", a read as "read N file(s)", an edit as "edited N file(s)", a search as "searched N time(s)", and any other call as "used N tool(s)", singular for one. Two commands and a read read "Ran 2 commands, read 1 file".
