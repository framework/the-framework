The "New preset" modal (#649/#626): name + prompt — prefilled from the composer's current text, the common "save what I just wrote" path — with a user/project save-scope choice when a project is open (#1025).

## TLDR

- Saves `{id: crypto.randomUUID() (fallback p-<ts>), label, prompt}` via `onSave(preset, scope)`; both fields required (trimmed) or the button disables; label capped at 80 chars.
- `PresetScope`: `'user'` ("Just me" — private, every project) or `'project'` ("This project" — committed to the repo, shared with the team); forced to `'user'` and the toggle hidden when `canSaveToProject` is false.
- Cmd/Ctrl+Enter saves, matching the composer (#948); Esc/close goes through the Dialog to `onCancel`.
- A modal over the composer rather than the earlier inline panel, which pushed the controls down.
