The "New preset" dialog: the user names a custom preset, edits the prompt it will run, and chooses where it is saved.

## Business logic — TL;DR

- **Save what you just wrote** - the prompt field opens prefilled with the composer's current text, so turning a prompt the user just typed into a custom preset takes only a name.
- **A preset is a name plus a prompt** - both must be non-empty (leading and trailing whitespace ignored) before the preset can be saved; the name is capped at 80 characters.
- **Two tiers: just me, or this project** - the user picks whether the custom preset stays private to them across every project, or is committed into the open project's repo and shared with their team. The choice is offered only when a project is open; otherwise the preset is saved as the user's own.
- **Keyboard shortcuts match the composer** - Ctrl/Cmd+Enter saves, Escape closes without saving.

## Business logic

### Save what you just wrote

#### User story

The user writes a prompt in the composer, likes it, and wants to reuse it later without retyping it.

#### Business logic

Opening the dialog copies the composer's current text into the prompt field, where the user can still edit it before saving. Saving trims the name and the prompt, and hands back a new custom preset with a freshly generated identifier.

### Two tiers: just me, or this project

#### User story

Some canned prompts are personal habits the user wants everywhere; others are conventions the whole team working on one repo should share.

#### Business logic

A "Save to" choice offers "Just me" (private to the user, available on every project) or "This project" (committed to the repo, shared with the team), defaulting to "Just me". When no project is open there is nothing to commit into, so the choice is hidden and the preset is always saved as the user's own.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
