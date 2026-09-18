The prompt editor of the composer [2]: where the user writes an agent's [1] prompt, in the launcher [5] and on an agent's page, as live markdown. Three menus open as the user types — `/` for the project's commands [3] and the saved prompts [6], `@` for projects, `#` for files — and a picked project or file becomes a chip that submits as the exact text the coding agent [4] reads.

## Context

**User story**: the user describes what to do, types `/` to load one of the project's commands or a saved prompt instead of writing from scratch, `@`-mentions another project or `#`-mentions a file so the prompt names it exactly, and presses Enter to start the agent. What the agent receives is plain prompt text; the chips are only how that text reads in the editor.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] composer: the prompt editor on a project's own page, also used to say something to an agent.
[3] command: one of the project's skills, read off the folders the coding agents read them from; typed as `/<name>`, optionally followed by an argument.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] launcher: the Start form on a project's own page.
[6] saved prompt: a prompt the user saved under a name, for themselves or for the project, loaded back into the editor verbatim.

## Business logic — TL;DR

- **Live markdown in, markdown out** - the user writes markdown with live formatting; what leaves the editor on every change is that markdown, with each chip written as its exact text.
- **The `/` menu: commands and saved prompts** - `/` lists the open project's commands [3], the user's and the project's saved prompts [6], and "Save prompt…"; picking a command loads `/<name> ` and picking a saved prompt loads it verbatim, each replacing the editor's content.
- **The `@` and `#` menus: projects and files** - `@` lists the registered projects and `#` the current project's files, at most eight each; a pick inserts a chip that submits as the project's name or the file's path.
- **Chips and how the menus behave** - a chip reads as a pill but submits as its text; a menu closes on a space or a non-matching query and never traps a stray character.
- **Loading a prompt replaces the draft** - a command, a saved prompt or an opening text replaces whatever is typed without asking, in one undo step; the caller learns whether a draft was replaced so it can say that undo brings it back.
- **Submit keys** - Enter and Cmd/Ctrl+Enter submit; Shift+Enter and Alt+Enter do not; Enter is left alone while a menu is open, inside a code block, or during an IME composition.
- **Placeholder, disabled state and the compact form** - an empty editor shows "Describe what to do…  ( / commands · @ projects · # files )"; a disabled editor is read-only; the navbar's compact form starts one line tall.

## Business logic

### Live markdown in, markdown out

#### Context

**User story**: the user types `**bold**` or `- item` and sees it formatted at once; the agent still receives plain markdown, exactly as the user would have written it in a text box.

#### Business logic

The editor is a markdown editor with live formatting shortcuts (headings, lists, bold, italic, code, code blocks). On every change the editor hands out its content as markdown. Rules of that markdown:

- A single newline stays a line break, so a saved prompt written one item per line survives instead of collapsing into one paragraph.
- HTML in the prompt is not rendered, and bare URLs are not turned into links.
- Pasted text is read as markdown.
- Each chip is written as its exact text, unescaped: `#src/my_file.ts` leaves as typed, never with a backslash in it.

The editor also exposes three operations to the surface that contains it: clear (empties the editor and reports an empty prompt), focus (puts the caret at the end), and load a text (see "Loading a prompt replaces the draft"). To assistive technology the editor is a multi-line text box labeled "Prompt".

### The `/` menu: commands and saved prompts

#### Context

**User story**: the user types `/` and picks "/work-queue" to run the project's command of that name, or picks a prompt they saved last week.

**Problem**: The Framework ships no prompt text. The `/` list is the open project's own skills, the way the coding agent's [4] own `/` list shows them, plus what people saved.

#### Business logic

Typing `/` opens a menu whose items, in this order, are:

- Under "Commands": every command [3] of the open project, shown as `/<name>`, with the command's description as hover text when it has one. Typing after the `/` keeps the commands whose name contains the typed text.
- Under "Saved prompts": the user's saved prompts [6], shown by name with the hint "saved prompt", then the open project's saved prompts committed in its repository, shown by name with the hint "project saved prompt". Both are filtered by name, case-insensitively.
- Under "Saved prompts": "Save prompt…" with the hint "save the current prompt", only where a save dialog exists (the full composer [2], not the navbar's compact launch) and only while the typed text is part of "save prompt".

What a pick does:

- A command: the `/` and the typed query are removed first (so they never count as a replaced draft), then `/<name> ` — the name and one trailing space, so an argument can follow — replaces the editor's content, and the surface is told `/<name>` and whether a typed draft was replaced.
- A saved prompt, the user's or the project's: same, with the saved text loaded verbatim and the surface told its name.
- "Save prompt…": the `/` and the query are removed so the save dialog captures the real prompt, then the dialog opens.

### The `@` and `#` menus: projects and files

#### Context

**User story**: the user writes "port the login flow from @my-other-app" or "fix #src/auth.ts"; the agent [1] reads the project's name or the file's exact path in its prompt.

#### Business logic

- Typing `@` opens a menu under "Projects" listing the registered projects by name as `@<name>` with the hint "project": the ones whose name contains the typed text, case-insensitively, and at most eight of them. When no project is registered, a fresh `@` shows "No projects to reference yet." instead of nothing. A pick inserts the chip `@<name>` followed by a space.
- Typing `#` opens a menu under "Files" listing the current project's files by repository-relative path as `#<path>` with the hint "file": the ones whose path contains the typed text, case-insensitively, and at most eight of them. When the project's file list is empty, a fresh `#` shows "No files indexed here yet.". A pick inserts the chip `#<path>` followed by a space.

A mention is text in the prompt and nothing more: it changes nothing else about the agent.

### Chips and how the menus behave

#### Context

**Business logic story**: a chip is a pill in the editor and exact text over the wire, so the prompt the coding agent [4] receives is the same whether the user typed the text or picked it.

#### Business logic

- A chip carries a label (what the pill shows) and a text (what is submitted); the chip is edited as one unit and cannot be edited character by character (the rules live in `prompt-editor/tokens.ts`). Only the `@` and `#` menus make chips: typed text never turns into one.
- All three menus behave alike (the rules live in `prompt-editor/suggestion.ts`): the menu appears below the caret; arrow keys move the highlight, Enter or Tab picks, Escape closes; a space ends the menu; a query that matches nothing hides the menu while the trigger stays armed, so a stray `/`, `@` or `#` in prose is never a trap and the menu reappears when a later character matches; the empty note is shown only on a fresh trigger with nothing typed yet.

### Loading a prompt replaces the draft

#### Context

**User story**: the user has typed half a prompt, then picks a command or a saved prompt; it replaces the draft without a confirmation dialog, and one undo brings the draft back. A page that opens the composer [2] with a prefilled text (a draft carried over from elsewhere) sees that text in the editor.

#### Business logic

- Loading a text — a command or a saved prompt from the `/` menu, or a load requested by the surface (the Commands menu, the launcher's command buttons) — replaces the whole content as plain text, places the caret at the end, and reports the new markdown. The load never asks for confirmation; it is one undo step, so undo restores the previous draft. The caller is told whether the editor held anything before the load, so its note can say that undo brings the draft back.
- An opening text handed to the editor is applied exactly once, as soon as the editor is ready, and never again: it is a draft to start from, not a value the surface controls, so re-applying it would overwrite what the user typed since.
- A load requested before the editor is ready does nothing and reports that nothing was replaced.

### Submit keys

#### Context

**User story**: the user presses Enter to send, like in Claude Code's web composer, and Shift+Enter to go to the next line.

#### Business logic

- Cmd+Enter and Ctrl+Enter always submit.
- Plain Enter submits, except in three cases where Enter already means something: while a menu is open (Enter picks the highlighted item), while the caret is inside a code block (Enter inserts a newline), and while an IME composition is being confirmed.
- Shift+Enter inserts a line break instead of submitting. Alt+Enter does not submit either.
- Submitting is the surface's job; the editor only signals it. It does not clear itself on submit.

### Placeholder, disabled state and the compact form

#### Context

**User story**: an empty composer [2] teaches its three menus in its placeholder; while an agent is starting the editor cannot be typed into; the navbar's quick launch offers the same editor in one line.

#### Business logic

- While the editor is empty it shows the placeholder "Describe what to do…  ( / commands · @ projects · # files )", unless the surface supplies its own placeholder.
- A disabled editor is read-only; enabling it makes it editable again.
- The editor grows with its content up to a maximum height, after which it scrolls. The compact form (the navbar's quick launch) starts one line tall and has a lower cap; the full composer starts taller. The compact form draws its own border; the full composer's border belongs to the composer box around it.
