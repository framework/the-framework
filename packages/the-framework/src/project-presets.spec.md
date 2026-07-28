Project-scoped custom presets (#1025): reads/writes the committed `.the-framework/custom-presets.json` so custom presets travel with the repo and everyone who clones it gets them.

## TLDR

- The project tier of custom presets — the user tier (#626) saves to the user's home file (private, follows the person); this one saves into the repo (shared).
- Store is a plain JSON array of `CustomPreset`, the exact shape the user tier uses, so the dashboard renders both from one type and the same `sanitizeCustomPresets` guards both files.
- `readProjectPresets`: forgiving — missing/unreadable/malformed yields `[]`; sanitizes so hand-edited or hostile entries are dropped.
- `writeProjectPresets`: sanitizes before writing, and ensures `.the-framework/.gitignore` carries the `!custom-presets.json` negation.

## Decisions

- The gitignore negation is required because the dir's ignore is `*` + a short allowlist (only `LOGS.md` committed by default) — without it git would never see the presets and they could not be shared. Appended only when not already present.
- Removing every preset writes an empty array rather than deleting the file, so the negation stays in place for the next save.
- Writing a bare negation into a repo with no `.gitignore` yet (pre-install dir) is harmless: it only bites once the `*` ignore exists, and self-heals when install adds the rest.
