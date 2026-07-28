The project panel's "Open in Finder / editor" (#490/#488): spawns a local OS command to reveal the repo in the file manager or open it in an editor, plus editor auto-detection for the picker (#727).

## TLDR

- `KNOWN_EDITORS` (VS Code, Cursor, Windsurf, Zed, Sublime, JetBrains, vim/emacs…) probed by CLI launcher on PATH via `detectEditors`/`nodeEditorProbe` — a pure `access()` lookup, nothing spawned; `$FRAMEWORK_EDITOR` and hand-typed values stay valid beyond the list.
- `openInApp(cwd, 'files'|'editor', run, editor?)`: file manager is `open`/`explorer`/`xdg-open` by platform; editor is the stored preference, else `$FRAMEWORK_EDITOR`, else `code`. Failures are values (`{ok:false, error}`), never throws; ENOENT reads as "not found on PATH".

## Decisions

- Localhost-only by construction: the path is the project's own registered path (never client input), and a public host has no local checkout to resolve.
- The spawn runner resolves on the `spawn` event, detached + unref'd — not on exit — so a long-lived editor (or `explorer`, which exits non-zero even on success) neither blocks nor errors.
- Windows probing tries `PATHEXT` suffixes and checks `F_OK` (not `X_OK`).
