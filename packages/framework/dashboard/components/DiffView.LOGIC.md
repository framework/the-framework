Renders what a file looks like in a card, the same way wherever the user meets it (the file tree's hover card and an agent's [1] Changes section): a changed file as its unified diff with colored added and removed lines, an unchanged file as its contents with line numbers, and the "+added −removed" count pair. Deliberately plain, with no syntax highlighting and no editing: the dashboard is not an editor, and this answers "what did the agent do" and "what is in this file", nothing more.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **A diff as colored lines** - each line of the diff renders verbatim in monospace: added lines green on a green wash, removed lines red on a red wash, hunk headers in the accent color, file headers and context lines muted.
- **A file as numbered lines** - an unchanged file renders line by line behind a right-aligned line-number gutter sized to its line count; an empty file reads "Empty file."
- **Binary and cut bodies say so** - a binary file reads "Binary file, nothing to show." instead of any body, and a diff or file the daemon cut at its preview cap ends with "Cut here. The rest is in the worktree."
- **The count pair** - "+<added>" in green and "−<removed>" in red, each shown only when above zero.

## Business logic

### A diff as colored lines

#### Context

**User story**: the user hovers a changed file, or opens an agent's [1] Changes section, and reads what changed as a plain unified diff.

#### Business logic

The diff arrives from the daemon as unified-diff text (what it holds is decided by the rules in `src/dashboard/file-diff.ts`) and is rendered one line per row, verbatim and monospaced, in a body that scrolls. A line starting with "+" is green on a faint green wash, one starting with "-" red on a faint red wash, a hunk header starting with "@@" takes the accent color, and the "---"/"+++" file headers and unchanged context lines are muted. An empty line keeps its row.

### A file as numbered lines

#### Context

**Problem**: an unchanged file has no added or removed lines to color; line numbers are what make a plain body scannable, and they are how the user says "line 40" to the agent [1] in the composer.

#### Business logic

An unchanged file's text renders line by line, each behind a right-aligned, unselectable line number in a gutter one character wider than the line count's digits. A file with no text reads "Empty file."

### Binary and cut bodies say so

#### Context

**Problem**: a file that is not text has nothing to render, and a very long diff or file would make the card unusable, so the daemon caps what it sends (500 lines, the cap in `src/dashboard/file-read.ts`) and says whether it cut.

#### Business logic

A diff or file the daemon marked binary renders as "Binary file, nothing to show." in place of any body. A diff or file the daemon marked as cut ends with the italic line "Cut here. The rest is in the worktree.", the same sentence for both, pointing the user at the checkout [2] for the rest.

### The count pair

#### Context

See "A diff as colored lines".

#### Business logic

The added and removed counts render as "+<added>" in green and "−<removed>" in red, in monospace with aligned digits; a count of zero is omitted, and a space separates the two only when both show.
