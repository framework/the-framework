The composer's presets button: the one place that loads, creates, and deletes presets.

## Business logic — TL;DR

- **Presets are discoverable** - a labelled button next to the composer opens the full list, so a first-time user sees that presets exist without knowing the `/` shortcut; its tooltip points out that typing `/` in the editor does the same.
- **Three groups in one menu** - the built-in presets first, then "Your presets" (the user's own custom presets), then "Project presets" (the open project's shared custom presets). A group with nothing in it is not shown.
- **Picking a preset loads its prompt** - the preset's prompt goes into the editor for the user to review and edit before sending; the user is never committed to sending it as-is.
- **Some presets always start their own agent** - a built-in preset can be marked as one that must run as a new agent instead of being sent into the agent currently open. A custom preset is always a plain load.
- **Delete where you load** - every custom preset row carries a delete control, so removing one happens in the same menu that loads it.
- **New preset…** - the last entry opens the create dialog, when a create dialog is available on this surface.

## Business logic

### Each built-in preset shows its slash name

#### User story

The user wants the fast path: typing `/` plus a name in the editor rather than opening a menu.

#### Business logic

Every built-in preset row shows its label together with the `/` command that loads it, so browsing the menu teaches the shortcuts. Built-in presets that carry an explanation show it on hover.

### Some presets always start their own agent

#### User story

A few canned prompts describe a whole task of their own, and appending them to the conversation of an agent already at work would derail that agent.

#### Business logic

A built-in preset can declare that loading it starts a new agent rather than continuing the open one; the menu passes that declaration along when the preset is picked. Loading a custom preset never does this.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
