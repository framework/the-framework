The rich prompt editor: the box the user writes an agent's prompt in, with live markdown, typed triggers that pull in presets, macro tags, projects and files, and the send-key bindings.

## Glossary

- **chip** - an inserted reference or tag shown as one inline pill the user can select and delete in a single step. A chip is only a display: the prompt handed to the agent contains the plain text the chip stands for.
- **macro tag** - one of the framework's repeated prompt tags, all written `<NAME>` (for example `<AWAIT>`, `<REVIEW_FILE>`).
- **agent action** - a call the prompt can ask the agent to make, for example `showMultiSelect()`.

## User story

- The user writes what to build, and wants formatting, canned prompts, and references to repos and files without leaving the keyboard or memorising exact spellings.
- The user wants to point an agent at a specific repo or file simply by mentioning it.

## Business logic — TL;DR

- **Four typed triggers** - `/` opens commands (presets, "New preset…", agent actions), `<` opens the macro tags, `@` opens the registered projects, `#` opens the open project's files. The placeholder spells all four out, so the editor teaches itself.
- **Chips that mean plain text** - anything inserted from a menu shows as a chip but leaves the prompt text exactly as the agent will read it, so nothing downstream is affected by how it was typed.
- **Mentioning is focusing** - picking a project or a file with `@` or `#` also adds it to the agent context; deleting that chip takes it back out, so the prompt and the Context list can never disagree.
- **Presets load in place** - picking a preset replaces the editor's content with the preset's prompt, with no blocking confirmation; the surrounding form is told whether a typed draft was overwritten so it can point out that a single undo brings it back.
- **Enter sends** - Enter and Ctrl/Cmd+Enter send; Shift+Enter inserts a line break. Enter yields wherever it already means something else: choosing from an open suggestion menu, a newline inside a code block, or confirming a text-input-method composition.
- **Markdown while you type** - markdown shortcuts apply live and survive the round trip, and a single newline stays a line break so a preset's one-per-line block does not collapse into a paragraph.
- **Grows with the prompt** - the box rests short and grows with its content up to a cap, then scrolls; a compact variant starts one line tall for the navbar's quick launch.
- **Opening text is a draft, not a value** - text the editor is opened with is applied once, the moment the editor is ready, and never re-applied over what the user has since typed.

## Business logic

### Four typed triggers

#### User story

See `## User story`.

#### Business logic

Typing one of four characters opens a filtered menu:

- `/` — commands. It lists the built-in presets under their slash names, then the user's own custom presets (hinted "saved preset"), then the open project's shared custom presets (hinted "project preset"), then "New preset…" which opens the create dialog with the prompt the user has written so far, then the agent actions. "New preset…" appears only on surfaces that have a create dialog, so the navbar's compact launch does not offer it.
- `<` — the macro tags. Typing a character that matches nothing, or a space, closes the menu, so a stray `<` in ordinary prose is not a trap.
- `@` — the registered projects, at most eight at a time; with none registered the menu says so instead of showing an empty list.
- `#` — the open project's tracked files, repo-relative, at most eight at a time; with no files indexed the menu says so.

Picking a preset loads its prompt; picking anything else inserts a chip followed by a space, ready to keep typing.

### Mentioning is focusing

#### User story

The user names a repo or a file in the prompt and expects the agent to actually be pointed at it — and expects removing that mention to undo it.

#### Business logic

Picking a project adds that project's checkout to the agent context; picking a file adds its repo-relative path. The editor keeps watch over which project and file chips are present: when one disappears — deleted by hand, or wiped out by loading a preset — the context entry it added is removed again.

#### Rationale

The chip was the only visible sign that the agent had been focused on that repo or file. A prompt that silently carried the focus after its chip was gone told the user something untrue.

### Presets load in place

#### User story

The user has typed a draft, then decides to start from a preset instead.

#### Business logic

Loading a preset replaces whatever is in the editor and does not ask for confirmation first. The editor reports back whether it overwrote a non-empty draft, so the surrounding form can note that undo brings the draft back — the replacement is grouped as a single undo step. Loading a built-in preset also passes along whether that preset must start an agent of its own rather than continue the open one.

### Enter sends

#### User story

The user expects the send key to behave the way it does in the coding-agent chat interfaces they already use.

#### Business logic

Enter alone sends the prompt, Shift+Enter inserts a line break, and Ctrl/Cmd+Enter sends from anywhere. Enter does not send while a suggestion menu is open (it picks the highlighted entry), inside a code block (it adds a line), or while a text input method is composing a character (it confirms the composition).

### Accessibility

#### User story

A user on a screen reader gets a properly announced, labelled, multi-line prompt field.

#### Business logic

The editing surface announces itself as a multi-line text box named "Prompt" and carries the placeholder as its announced placeholder; the visible placeholder text is decoration on top of that.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
