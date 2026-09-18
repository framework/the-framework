The "Commands" button beside the composer [1]: one dropdown that lists the open project's commands [2], the user's own saved prompts [3] and the project's saved prompts, loads the picked one into the editor, deletes a saved prompt from its row, and opens the dialog that saves the current prompt.

## Context

**User story**: a first-time user with an empty composer sees a button that reveals what this project can be asked to do and clicks one to load it; a returning user deletes a saved prompt they no longer use from the same menu. Typing `/` in the editor stays the fast path for those who know it.

**Problem**: The Framework ships no prompts of its own. The menu therefore has nothing to list but what the project's own skills say and what people saved, and a project with no skills must not look broken.

## Glossary

[1] composer: the prompt editor on a project's own page, also used to say something to an agent.
[2] command: one of the project's skills, read off the folders the coding agents read them from; typed as `/<name>`, optionally followed by an argument.
[3] saved prompt: a prompt the user saved under a name, either for themselves (kept with their preferences) or for the project (committed in the project's repository), and loads back into the editor verbatim.

## Business logic — TL;DR

- **The three sections** - "Commands", then "Your saved prompts" and "Project saved prompts" when there are any, then "Save prompt…" where a save dialog exists.
- **Loading** - a command loads as `/<name> ` so an argument can follow; a saved prompt loads verbatim.
- **Deleting** - the `X` on a saved prompt's row deletes it without loading it; the user's own and the project's go to their own stores.

## Business logic

### The three sections

#### Context

See `## Context`.

#### Business logic

The button is named "Commands" and its tooltip reads "Run a command or load a saved prompt — also available by typing / in the editor". The menu holds:

- "Commands": every command [2] of the open project, each as `/<name>`, with its description as the row's tooltip when it has one. A project with none shows "This project has no commands." in its place.
- "Your saved prompts": the user's own saved prompts [3], by name. The section is absent when there are none.
- "Project saved prompts": the open project's saved prompts. The section is absent when there are none.
- "Save prompt…", which opens the save dialog (`PresetCreatePanel.tsx`). The item is absent on a surface that has no such dialog.

Every row is disabled while the embedding composer [1] is busy.

### Loading

#### Context

See `## Context`.

#### Business logic

Picking a command hands the composer the text `/<name> ` — the name and one trailing space — and the label `/<name>`. Picking a saved prompt hands it the saved text as it is, and its name as the label. What the composer does with them (replace the editor's content, tell the launcher what was loaded) is in `Composer.tsx`.

### Deleting

#### Context

**Problem**: a delete button inside a row that loads on click must not also load.

#### Business logic

Each saved prompt's row ends in an `X` named "Delete preset `<name>`", with the tooltip "Delete "`<name>`"". A click on it deletes that saved prompt and does not load it. One of the user's own is deleted through the handler for the user's saved prompts, one of the project's through the handler for the project's, so each lands in its own store. Commands have no `X`: they are the project's skills, changed in the repository.
