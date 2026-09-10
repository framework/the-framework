The prompt editor of the composer [2]: where the user writes an agent's [1] prompt, in the launcher [5] and in live chat [3], as live markdown. Four menus open as the user types — `/` for presets and agent actions, `<` for the macro tags, `@` for projects, `#` for files — and every pick becomes a chip that submits as the exact text the coding agent [4] reads, so nothing downstream changes.

## Context

**User story**: the user describes what to build, types `/` to load a preset instead of writing from scratch, `@`-mentions another project or `#`-mentions a file so the agent focuses on it, and presses Enter to start the agent. What the agent receives is plain prompt text; the chips are only how that text reads in the editor.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] composer: the prompt editor on a project's own page, also used for live chat.
[3] live chat: the user's own messages to a running agent, each continuing the same driver session.
[4] coding agent: the CLI doing the actual work: Claude Code or Codex.
[5] launcher: the Start form on a project's own page.
[6] custom preset: a preset the user saved.
[7] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[8] view: a markdown document an agent pushes to the dashboard's right rail while it works.

## Business logic — TL;DR

- **Live markdown in, markdown out** - the user writes markdown with live formatting; what leaves the editor on every change is that markdown, with each chip written as its exact text.
- **The `/` menu: presets and agent actions** - `/` lists the built-in presets, the user's and the project's custom presets [6], "New preset…", and the three agent actions; picking a preset loads its prompt, picking an action inserts a chip.
- **The `<` menu: macro tags** - `<` lists the six tags a prompt may repeat (`<AWAIT>`, `<REVIEW_FILE>`, …) and inserts the picked one as a chip.
- **The `@` and `#` menus: projects and files** - `@` lists the registered projects and `#` the current project's files, at most eight each; a pick inserts a chip and adds the project or file to the agent's Context.
- **A removed chip leaves the Context too** - when an `@` or `#` chip disappears from the editor, the Context focus it added is withdrawn, so the prompt and the Context never disagree.
- **Chips and how the menus behave** - a chip reads as a pill but submits as its text; a fully typed tag or action call turns into a chip by itself; a menu closes on a space or a non-matching query and never traps a stray character.
- **Loading a prompt replaces the draft** - a preset or an opening text replaces whatever is typed without asking, in one undo step; the caller learns whether a draft was replaced so it can say that undo brings it back.
- **Submit keys** - Enter and Cmd/Ctrl+Enter submit; Shift+Enter and Alt+Enter do not; Enter is left alone while a menu is open, inside a code block, or during an IME composition.
- **Placeholder, disabled state and the compact form** - an empty editor shows "Describe what to build…  ( / commands · < tags · @ projects · # files )"; a disabled editor is read-only; the navbar's compact form starts one line tall.

## Business logic

### Live markdown in, markdown out

#### Context

**User story**: the user types `**bold**` or `- item` and sees it formatted at once; the agent still receives plain markdown, exactly as the user would have written it in a text box.

#### Business logic

The editor is a markdown editor with live formatting shortcuts (headings, lists, bold, italic, code, code blocks). On every change the editor hands out its content as markdown. Rules of that markdown:

- A single newline stays a line break, so a preset's line-per-line definition block (`REVIEW_FILE: …` on one line, `TODO_FILE: …` on the next) survives instead of collapsing into one paragraph.
- HTML in the prompt is not rendered, and bare URLs are not turned into links.
- Pasted text is read as markdown.
- Each chip is written as its exact text, unescaped: `<AWAIT>` leaves as `<AWAIT>`, never as `\<AWAIT\>`.

The editor also exposes three operations to the surface that contains it: clear (empties the editor and reports an empty prompt), focus (puts the caret at the end), and load a text (see "Loading a prompt replaces the draft"). To assistive technology the editor is a multi-line text box labeled "Prompt".

### The `/` menu: presets and agent actions

#### Context

**User story**: the user types `/` and picks "/research" to load the research preset, or picks `showMultiSelect()` to have the agent stop at a multi-select gate [7] at that point of the prompt.

#### Business logic

Typing `/` opens a menu whose items, in this order, are:

- Under "Presets": every built-in preset, shown as `/<preset id>` with the preset's label as its hint (and its tooltip as hover text when the preset has one). Typing after the `/` keeps the presets whose id contains the typed text or whose label contains it, case-insensitively for the label.
- Under "Presets": the user's custom presets [6], shown by label with the hint "saved preset", then the open project's custom presets committed in its repository, shown by label with the hint "project preset". Both are filtered by label, case-insensitively.
- Under "Presets": "New preset…" with the hint "save the current prompt", only where a create panel exists (the full composer [2], not the navbar's compact launch) and only while the typed text is a prefix of "new preset".
- Under "Actions": the three agent actions, `showChoices()` ("Single-select gate"), `showMultiSelect()` ("Multi-select gate") and `showMarkdown()` ("Push a markdown view [8]"), filtered by label.

What a pick does:

- A built-in preset: the `/` and the typed query are removed first (so they never count as a replaced draft), the preset's prompt as rendered for this surface replaces the editor's content, and the surface is told the preset's label, whether a typed draft was replaced, and whether the preset always starts an agent [1] of its own even when loaded from inside a running agent's live chat [3].
- A custom preset, the user's or the project's: same, with the saved prompt loaded verbatim; such presets never carry the "agent of its own" rule.
- "New preset…": the `/` and the query are removed so the create panel captures the real prompt, then the create panel opens.
- An action: a chip for the call is inserted in place of the `/` and the query, followed by a space.

### The `<` menu: macro tags

#### Context

**User story**: the user types `<` and picks `AWAIT` to tell the agent to stop and wait for them at that point, without having to remember the exact tag.

#### Business logic

Typing `<` opens a menu under "Tags" with the six tags a prompt may repeat, each with a hint: `AWAIT` ("Stop and wait for the user"), `REVIEW_FILE` ("The review scratch file"), `TODO_FILE` ("The session TODO file"), `PLAN_FILE` ("The session plan file"), `SESSION_NAME` ("The sanitized branch slug") and `FUNCTION` ("A function placeholder"). Typing after the `<` keeps the tags whose name contains the typed text. A pick inserts the tag as a chip, followed by a space; the chip submits as `<NAME>`. The catalog of tags and actions lives in `prompt-editor/tokens.ts`.

### The `@` and `#` menus: projects and files

#### Context

**User story**: the user writes "port the login flow from @my-other-app" or "fix #src/auth.ts"; the agent [1] both reads the mention in its prompt and is focused on that project or file through the launcher's [5] "Context".

#### Business logic

- Typing `@` opens a menu under "Projects" listing the registered projects by name as `@<name>` with the hint "project": the ones whose name contains the typed text, case-insensitively, and at most eight of them. When no project is registered, a fresh `@` shows "No projects to reference yet." instead of nothing. A pick inserts the chip `@<name>` followed by a space, and adds the project's path to the agent's Context.
- Typing `#` opens a menu under "Files" listing the current project's files by repository-relative path as `#<path>` with the hint "file": the ones whose path contains the typed text, case-insensitively, and at most eight of them. When the project's file list is empty, a fresh `#` shows "No files indexed here yet.". A pick inserts the chip `#<path>` followed by a space, and adds that path to the agent's Context.

### A removed chip leaves the Context too

#### Context

**Problem**: the chip is the only visible sign that the agent [1] was focused on a project or file. A prompt without the chip that still carried the focus would lie about what the agent gets.

#### Business logic

After every change of the editor's content, the `@` and `#` chips now present are compared with the ones present before. For each chip that is gone — deleted by the user, or wiped because a preset replaced the content — the Context focus it added is withdrawn: a `#` chip withdraws its file path; an `@` chip withdraws the path of the registered project with that name, and withdraws nothing when no registered project has that name anymore. Clearing the editor withdraws every chip's focus the same way.

### Chips and how the menus behave

#### Context

**Business logic story**: a chip is a pill in the editor and exact text over the wire, so the prompt the coding agent [4] receives is the same whether the user typed the text or picked it.

#### Business logic

- A chip carries a label (what the pill shows) and a text (what is submitted); the chip is edited as one unit and cannot be edited character by character.
- Typing a complete tag such as `<AWAIT>` or a complete action call such as `showChoices()` turns it into a chip as soon as the closing `>` or `)` lands; a known tag typed in the wrong case (`<await>`) is normalized to its canonical form (`<AWAIT>`); an unknown tag or call keeps exactly what was typed. When a preset is loaded, every tag and action call in its text becomes a chip, except inside inline code, which stays verbatim (the rules live in `prompt-editor/tokens.ts` and `prompt-editor/tokenize.ts`).
- All four menus behave alike (the rules live in `prompt-editor/suggestion.ts`): the menu appears below the caret; arrow keys move the highlight, Enter or Tab picks, Escape closes; a space ends the menu; a query that matches nothing hides the menu while the trigger stays armed, so a stray `/`, `<`, `@` or `#` in prose is never a trap and the menu reappears when a later character matches; the empty note is shown only on a fresh trigger with nothing typed yet.

### Loading a prompt replaces the draft

#### Context

**User story**: the user has typed half a prompt, then picks a preset; the preset replaces the draft without a confirmation dialog, and one undo brings the draft back. A page that opens the composer [2] with a prefilled text (a draft carried over from elsewhere) sees that text in the editor.

#### Business logic

- Loading a text — a preset from the `/` menu, or a load requested by the surface — replaces the whole content, turns the text's tags and calls into chips, places the caret at the end, and reports the new markdown. The load never asks for confirmation; it is one undo step, so undo restores the previous draft. The caller is told whether the editor held anything before the load, so its note can say that undo brings the draft back.
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

**User story**: an empty composer [2] teaches its four menus in its placeholder; while an agent is starting the editor cannot be typed into; the navbar's quick launch offers the same editor in one line.

#### Business logic

- While the editor is empty it shows the placeholder "Describe what to build…  ( / commands · < tags · @ projects · # files )", unless the surface supplies its own placeholder.
- A disabled editor is read-only; enabling it makes it editable again.
- The editor grows with its content up to a maximum height, after which it scrolls. The compact form (the navbar's quick launch) starts one line tall and has a lower cap; the full composer starts taller. The compact form draws its own border; the full composer's border belongs to the composer box around it.
