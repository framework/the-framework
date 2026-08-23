The dashboard's handles for the settings the user controls: their own preferences, a project's shared custom presets, and the Discord credentials the daemon delivers notifications with.

Each handle is declared against the daemon's own implementation of that read or write, so a rename or a changed shape breaks the dashboard at build time instead of failing as a missing route once a user opens Settings.

## Business logic — TL;DR

- **Preferences** - read the user's preferences, replace them wholesale, or merge in just the keys this tab changed and adopt what is stored afterwards.
- **Project presets** - read and write the custom presets a project shares with everyone who works on it, as opposed to the user's own.
- **Preferred editor** - list the editors installed on the daemon's machine, so the user picks one that actually exists.
- **Notification channels** - ask which channels the daemon can really deliver on, so the dashboard never offers a channel that would deliver nothing.
- **Discord credentials** - hand the daemon the Discord credentials; they are write-only, and the browser only ever learns that they are present.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
