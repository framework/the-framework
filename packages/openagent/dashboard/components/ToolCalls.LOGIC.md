Draws what the coding agent [3] did between two of its messages in an agent's [1] transcript: one folded grey line for the whole run of steps [4], which opens to one line per step.

## Context

**User story**: the user reads the agent's messages and, between them, one short grey line saying what the coding agent did ("Ran 2 commands"), as Claude Code on the web draws it, with the file an edit changed and its size ("Ran 3 commands, created DESCRIPTION.md +11 −0"). The user opens the line to see each tool call [2], and opens a call to see its command or its file's whole path and what the call printed.

**Problem**: the transcript showed one row per tool call and one "Thinking" row per thought. A turn of fifty calls was fifty rows between the user's question and the agent's answer.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] tool call: one use of a tool by the coding agent (running a command, reading a file, editing a file, searching), reported as a label and, when the call has one, a detail: the one argument that says what it did (the command, the file, the address), on one line and cut short. A call may also carry that argument whole, and what it gave back: its output [5].
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] step: a tool call, or a thought of the coding agent as its CLI summarizes it.
[5] output: what a tool call printed, cut to a size limit by the tool that runs the coding agent, with whether the call failed and, for a command whose CLI reports one, its exit code. The output of a call that edited files may also say the files the call changed, each with its lines added and removed, and whether the call made the file: the call's line and the run's line then name the files and say their size [6].
[6] size: the lines added and the lines removed, drawn as "+11 −0": "+" and the lines added in green, a space, "−" and the lines removed in red, as the transcript's rows of changed files draw them (`ChangedFiles.tsx`).

## Business logic — TL;DR

- **A run of steps is one line** - the calls counted by kind, the edits whose files are known said by their files and their size [6], folded; opened, a bordered box with one line per step, in order.
- **A lone call is its own line** - the verb in grey and what it was done to in dark, then its size [6] when its output says the files it changed, with no count.
- **A call opens to its detail and its output** - a call opens to its detail whole, a command with "$" in front, and under it what it printed, in a box that scrolls; a failed call says so; a call with neither does not open.
- **A thought is inside the box** - no line of the transcript; in the opened box it reads "Thought" and opens to the thought.
- **Thoughts alone draw nothing** - a run with no call in it has no line.
- **The line going on now** - while the agent works, one moving line: the call going on now in the present ("Running pnpm test 9s"), or a word given by the transcript, with moving dots, shimmering text and the seconds counting.

## Business logic

### A run of steps is one line

#### Context

See `## Context`.

#### Business logic

The component is given the steps [4] of one run, in order (which steps make a run is the transcript's rule, `EventList.tsx`). It draws one grey line in the page's own font: the calls counted by kind (the wording in `lib/tool-calls.ts`, "Ran 2 commands, read 1 file") and a chevron pointing right. Each call is read with the files its output [5] says it changed, so the edits whose files are known are said by their files, with their size [6] drawn right after the words of their part and before the comma: "Ran 3 commands, created DESCRIPTION.md +11 −0" (which files, which verb and which lines are `lib/tool-calls.ts`'s). A run in which no output says a file has no size. The line is a button whose accessible name is the whole line, its sizes included; a line too long for the row wraps. The line starts folded. A click opens, under the line, a box with a border and round corners holding one line per step, in the order they happened, and turns the chevron to point down; a click on the line again folds the box away.

### A lone call is its own line

#### Context

**User story**: when the coding agent did one thing, the user reads what it was at once, without opening a line that says "Read 1 file".

#### Business logic

A run that is exactly one tool call [2], with no thought, is drawn as that call's line, with no count and no box: the verb in grey, then the target in the dark text color, cut with an ellipsis when it does not fit the row (the verb and the target are `lib/tool-calls.ts`'s: "Read AGENTS.md"). A call whose output [5] says the files it changed reads by them: "Created" or "Edited", the files' names, then the call's size [6] ("Created DESCRIPTION.md +11 −0"). The same line is how each call reads inside an opened box.

### A call opens to its detail and its output

#### Context

**User story**: the user opens a command the coding agent ran and reads the command and what it printed, as Claude Code on the web shows it, without opening a terminal or the agent's diary.

#### Business logic

A call's line with a detail or an output [5] ends with a chevron pointing right and is a button whose accessible name is the verb and the target, without the size [6]. A click turns the chevron to point down and opens, under the line, in order:

- the detail in a grey box in a monospace font, wrapping instead of being cut: the argument whole when the call carries it (a command of several lines keeps its lines), else the detail. A command (Claude Code's `Bash`, Codex's `commandExecution`) has "$" in grey in front of it; any other call has none.
- the output, when the call has one whose text is not empty: a box with a border, in the same font, wrapping.
- when the output says the call failed: one red line, "Failed: exit code 1" when it carries an exit code, else "Failed".

Each box is at most 16rem tall and scrolls inside itself past that. A click on the line again folds it all. A call with no detail and no output is plain text: no chevron, nothing to open. A call still going on has no output yet.

### A thought is inside the box

#### Context

**User story**: Claude Code on the web shows no thinking row, and the user wants the same. What the coding agent thought must still be reachable: nothing is hidden for good.

#### Business logic

A thought has no line of its own in the transcript. Inside an opened box, at the place it was thought, it is one line reading "Thought" with a chevron pointing right; a click opens the thought under it, as compact Markdown in italics, and a click again folds it. Codex sends a thought only when it has a summary of its reasoning, so its runs often hold none.

### Thoughts alone draw nothing

#### Context

See "A thought is inside the box".

#### Business logic

A run with no tool call in it (the coding agent thought, then wrote its message) draws nothing at all. Such a thought is the one thing of the agent's diary the transcript does not let the user reach.

### The line going on now

#### Context

**User story**: while the agent works, the user sees at the bottom of the transcript what the coding agent is doing at this moment and for how long, moving, so a quiet agent never looks stalled: "Reading AGENTS.md 9s", as Claude Code on the web shows it.

**Problem**: the coding agents report a call when it begins and report nothing that sums it up in words, so the line can only say the command or the file. A call that began and has no later event is the call going on now.

#### Business logic

A second component draws the transcript's last line while the agent works (when it is shown, and which call or word it is given, is the transcript's rule, `EventList.tsx`). The line is announced to assistive technology as a status. It holds, in order:

- three small dots rising one after the other, over and over;
- when it is given a call: the call's line as in "A lone call is its own line", except that the verb is in its form for a call still going on ("Running", "Reading"; `lib/tool-calls.ts`), and the verb and the target are grey with a band of light crossing them, over and over. It opens on a click like any call;
- when it is given no call: the word the transcript gave ("Starting…", "Working…"), with the same band of light;
- when it is given the moment the line's subject began: the time since then, counted up every second, as "9s" below one minute and "1m 5s" from then on. Without that moment there is no count.

For a reader whose system asks for reduced motion, the dots stand still and the text is plain grey.

The dots and the count of the time are also what the session line is drawn with while the session is being set up (`SessionLine.tsx`).
