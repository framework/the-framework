Says how a tool call [2] of the coding agent [3] reads in an agent's [1] transcript: a verb and what it was done to ("Read AGENTS.md", "Ran pnpm test"), and how several calls sum up in one line ("Ran 2 commands, read 1 file"), an edit whose files are known [4] naming its file and its size ("Ran 3 commands, created DESCRIPTION.md +11 −0").

## Context

**User story**: the user reads what the coding agent did between two of its messages as short plain lines, the way Claude Code on the web writes them, and reads the same lines whether the agent is Claude Code or Codex.

**Problem**: both coding agents report a call as a label and a detail, but the labels differ. Claude Code's label is the tool's name ("Bash", "Read", "Edit"). Codex's label is the kind of the thing it did ("commandExecution", "fileChange"). Neither is a word a reader wants to read.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] tool call: one use of a tool by the coding agent (running a command, reading a file, editing a file, searching), reported as a label and, when the call has one, a detail: the one argument that says what it did (the command, the file, the address), on one line and cut short.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] edit whose files are known: a tool call whose coding agent said, on what the call gave back, the files the call changed: each file's path, the lines added, the lines removed, and whether the call made the file. A call from before the coding agents said them, and a call that changed no file, is not one.
[5] size: the lines added and the lines removed, said as "+11 −0".

## Business logic — TL;DR

- **One call as a verb and a target** - the label picks the verb, its form for a call still going on, and the kind of the call; the detail is the target, a file reading as its name alone.
- **An edit whose files are known names them** - it reads "Created" when it made every file it changed and "Edited" otherwise, whatever its tool is called, with its files' names and its size [5].
- **Several calls as counts** - each kind counted, in the order the kinds first came; the edits whose files are known [4] are said by their files and their size instead of counted.

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

### An edit whose files are known names them

#### Context

**User story**: the user reads which file the coding agent made or edited, and by how many lines, on the call's own line, as Claude Code on the web says it ("Created DESCRIPTION.md +11 −0").

**Problem**: the label does not say whether a call made a file: Claude Code's "Write" both makes a file and writes over one that was there, and Codex's "fileChange" does either.

#### Business logic

A call may be given the files it changed, as its coding agent said them [4]. When it is given at least one:

- its files are each said once, in the order first changed, with their lines summed (the rule in `turn-changes.ts`, "Each file once, its edits summed" and "A file the edits made");
- its kind is "edit", whatever the label;
- its verb is "Created" when the call made every one of its files, and "Edited" otherwise, whatever the label: a "Write" over a file that was there reads "Edited". The verb's form for a call still going on stays the label's;
- its target is its files' names, separated by a comma and a space;
- it carries its size [5]: the lines added and the lines removed over all its files.

A call given no file, or an empty list of files, reads by its label and its detail alone, with no size.

### Several calls as counts

#### Context

See `## Context`.

#### Business logic

A list of calls reads as one line, made of parts: each kind's count, in the order the kinds first came in the list, separated by a comma and a space, with a capital first. A command counts as "ran N command(s)", a read as "read N file(s)", an edit as "edited N file(s)", a search as "searched N time(s)", and any other call as "used N tool(s)", singular for one. Two commands and a read read "Ran 2 commands, read 1 file". A list with no call has no part.

The edits whose files are known [4] are not counted as calls. At the place of the edits' count, they are said by their files:

- The files of all these edits are taken together, each once, with their lines summed as a turn's are (the rule in `turn-changes.ts`): a file edited by several calls of the list is one file, and a file one of the calls made reads the lines it holds at the end. A file made by one call (+11 −0) and edited by a later one (+2 −1) reads "+12 −0".
- One file is said by its name ("created DESCRIPTION.md"), several by how many ("edited 3 files").
- The verb is "created" when the calls of the list made every one of the files, and "edited" otherwise.
- The part carries the size [5] of the files together, kept apart from the words so that the transcript draws it in its own colors.

The edits whose files are not known (calls of an agent that ran before the coding agents said them) are counted as calls, "edited N file(s)". When the list holds edits of both sorts, the part of the known files comes first and the count of the others right after it: "Edited app.ts +2 −1, edited 1 file".

The line is also given as one string, each part followed by its size when it has one: "Ran 3 commands, created DESCRIPTION.md +11 −0".
