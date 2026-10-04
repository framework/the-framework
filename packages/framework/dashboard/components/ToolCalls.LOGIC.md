Draws what the coding agent [3] did between two of its messages in an agent's [1] transcript: one folded grey line for the whole run of steps [4], which opens to one line per step.

## Context

**User story**: the user reads the agent's messages and, between them, one short grey line saying what the coding agent did ("Ran 2 commands"), as Claude Code on the web draws it. The user opens the line to see each tool call [2], and opens a call to see its command or its file's whole path.

**Problem**: the transcript showed one row per tool call and one "Thinking" row per thought. A turn of fifty calls was fifty rows between the user's question and the agent's answer.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] tool call: one use of a tool by the coding agent (running a command, reading a file, editing a file, searching), reported as a label and, when the call has one, a detail: the one argument that says what it did (the command, the file, the address), on one line and cut short.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] step: a tool call, or a thought of the coding agent as its CLI summarizes it.

## Business logic — TL;DR

- **A run of steps is one line** - the calls counted by kind, folded; opened, a bordered box with one line per step, in order.
- **A lone call is its own line** - the verb in grey and what it was done to in dark, with no count.
- **A call opens to its detail** - a call with a detail opens to the detail whole; one with none does not open.
- **A thought is inside the box** - no line of the transcript; in the opened box it reads "Thought" and opens to the thought.
- **Thoughts alone draw nothing** - a run with no call in it has no line.
- **The line going on now** - while the agent works, one moving line: the call going on now in the present ("Running pnpm test 9s"), or a word given by the transcript, with moving dots, shimmering text and the seconds counting.

## Business logic

### A run of steps is one line

#### Context

See `## Context`.

#### Business logic

The component is given the steps [4] of one run, in order (which steps make a run is the transcript's rule, `EventList.tsx`). It draws one grey line in the page's own font: the calls counted by kind (the wording in `lib/tool-calls.ts`, "Ran 2 commands, read 1 file") and a chevron pointing down. The line starts folded. A click opens, under the line, a box with a border and round corners holding one line per step, in the order they happened, and turns the chevron to point up; a click on the line again folds the box away.

### A lone call is its own line

#### Context

**User story**: when the coding agent did one thing, the user reads what it was at once, without opening a line that says "Read 1 file".

#### Business logic

A run that is exactly one tool call [2], with no thought, is drawn as that call's line, with no count and no box: the verb in grey, then the target in the dark text color, cut with an ellipsis when it does not fit the row (the verb and the target are `lib/tool-calls.ts`'s: "Read AGENTS.md"). The same line is how each call reads inside an opened box.

### A call opens to its detail

#### Context

See `## Context`.

#### Business logic

A call's line with a detail ends with a chevron pointing right and is a button whose accessible name is the verb and the target. A click opens, under the line, the detail whole (the command, the file's whole path) in a grey box in a monospace font, wrapping instead of being cut, and turns the chevron to point down; a click again folds it. A call with no detail is plain text: no chevron, nothing to open.

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
- when it is given a call: the call's line as in "A lone call is its own line", except that the verb is in its form for a call still going on ("Running", "Reading"; `lib/tool-calls.ts`), and the verb and the target are grey with a band of light crossing them, over and over. It opens to its detail on a click like any call;
- when it is given no call: the word the transcript gave ("Starting…", "Working…"), with the same band of light;
- when it is given the moment the line's subject began: the time since then, counted up every second, as "9s" below one minute and "1m 5s" from then on. Without that moment there is no count.

For a reader whose system asks for reduced motion, the dots stand still and the text is plain grey.
