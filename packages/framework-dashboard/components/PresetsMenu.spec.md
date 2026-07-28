The composer's Presets button (#948): the one visible surface that loads, creates, and deletes presets — built-ins, the user's saved ones, and the project's shared ones (#1025) — while typing `/` in the editor stays the fast path.

## TLDR

- Built-in `PresetEntry` rows load `render()` output and pass `newSession` through (#959: presets that run in a session of their own even when loaded from inside one); each shows `/<id>` as its description and its tooltip when present.
- Saved rows (user and project) load their `prompt` verbatim and carry an X that deletes via `stopPropagation` without loading — user presets through `onDelete`, project presets through `onDeleteProject`; either group hides when empty.
- "New preset…" renders only when `onNew` is passed (the compact navbar launch has no create panel and passes none).
- Exists because loading used to hide behind typing `/` (with the preset cards/dropdown gone in #722, an empty box gave a first-time user no sign 13 launcher presets exist) and deleting lived in the options gear — a different menu.
