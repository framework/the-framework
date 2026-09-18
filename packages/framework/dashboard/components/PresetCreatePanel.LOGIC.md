The "Save prompt" dialog: saves the prompt the user just wrote as a saved prompt [1] — a name plus a prompt — either privately for the user on every project ("Just me") or committed into the open project's repository for the whole team ("This project").

## Context

**User story**: the user has crafted a prompt they want to reuse; they pick "Save prompt…", give it a name, choose whether it is theirs alone or the project's, and it appears in the "Commands" menu and the `/` menu from then on.

## Glossary

[1] saved prompt: a prompt the user saved under a name, for themselves or for the project, loaded back into the editor verbatim.
[2] composer: the prompt editor on a project's own page, also used to say something to an agent.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **Prefilled from the editor** - the dialog opens with the composer's [2] current text as the prompt and an empty, focused "Name" field.
- **Saving requires both fields** - "Save prompt" is disabled until the name and the prompt are both non-blank; both are trimmed on save, the name is capped at 80 characters, and Cmd/Ctrl+Enter saves.
- **Where it is saved** - with a project open, a "Save to" switch chooses "Just me" ("Private to you, on every project", the default) or "This project" ("Committed to the repo, shared with your team"); with no project open there is no choice and the saved prompt is the user's.
- **Cancel and limits** - "Cancel", Escape or closing the dialog backs out; the daemon caps the user's saved prompts at 30, each name at 80 and each prompt at 20,000 characters.

## Business logic

### Prefilled from the editor

#### Context

See `## Context`.

#### Business logic

The dialog is modal over the composer [2], titled "Save prompt". Its prompt box (placeholder "The prompt to save…", five lines tall, resizable) opens filled with the editor's current text, so the common case is saving what was just written; the text can be edited before saving. The name field (placeholder "Name") opens empty and focused. Both fields are disabled while the surface is busy.

### Saving requires both fields

#### Context

**Problem**: a saved prompt without a name cannot be found in the menus, and one without a prompt loads nothing.

#### Business logic

"Save prompt" is disabled while the surface is busy or while either the name or the prompt is blank after trimming. Saving trims both, gives the saved prompt a fresh random id, and hands it to the surface with the chosen destination. The name field refuses input beyond 80 characters. Cmd+Enter or Ctrl+Enter anywhere in the dialog saves, the same key the composer [2] uses to submit.

### Where it is saved

#### Context

**User story**: a saved prompt that encodes the team's own workflow belongs in the repository, where everyone who clones it gets it; a personal shortcut stays on the user's machine and follows them to every project.

#### Business logic

- When a project is open, a "Save to" switch offers "Just me" and "This project", "Just me" selected by default. Next to it a note describes the selection: "Private to you, on every project" for "Just me", "Committed to the repo, shared with your team" for "This project".
- A prompt saved to "Just me" goes into the user's preferences [3]; one saved to "This project" goes into the project's `.the-framework/custom-presets.json`, committed in its repository. The surface performs the save; this dialog only reports the choice.
- With no project open there is nothing to commit into: the switch is not shown and the saved prompt is always the user's.

### Cancel and limits

#### Context

See `## Context`.

#### Business logic

"Cancel", the Escape key, or closing the dialog backs out without saving. The daemon, when it stores the user's saved prompts, keeps at most 30 of them and caps each name at 80 and each prompt at 20,000 characters (the rule lives in `src/registry.ts`).
