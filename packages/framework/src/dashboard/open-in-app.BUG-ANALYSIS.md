# Bug analysis: packages/framework/src/dashboard/open-in-app.ts

## Business logic (high-level)

The project panel's "Open in Finder / editor" (#490/#727): the daemon spawns a local OS command to reveal the registered project path in the file manager or open it in an editor. Security posture is sound: the path is always the project's own registered path (never client input) and is passed as a single argv element (no shell), so no injection surface. Cross-platform intent is explicit (darwin `open`, win32 `explorer`, else `xdg-open`; PATHEXT-aware probing), so Windows behavior is in scope.

Key behaviors per SPEC:
- editor resolution: stored preference → `$FRAMEWORK_EDITOR` → `code`; hand-typed launchers stay valid (a single binary name — a value with flags like `code -n` would be spawned as one literal command name; the SPEC frames the value as a launcher CLI, so noted as a reliance, not a bug);
- detection is a pure PATH lookup, nothing spawned; picker shows installed subset in catalog order;
- spawn is detached and resolves on launch, not exit (so `explorer`'s non-zero exit is not a failure and an editor never blocks the daemon);
- failures are values: ENOENT → friendly "not found on PATH", anything else → the error's message.

## Functions (low-level)

- **`KNOWN_EDITORS`** — fixed catalog; order is display order. Correct.
- **`nodeEditorProbe(env, os)`** — splits PATH once at construction; on win32 uses `F_OK` and PATHEXT suffixes (default `.EXE;.CMD;.BAT;.COM`), else `X_OK` and the bare name. Edge cases: empty PATH → no dirs → always false (fine). On win32 the bare name is *not* probed (exts lack `''`) — correct, Windows executables need an extension. On POSIX, `access(join(dir, bin), X_OK)` also succeeds for a **directory** named like a launcher sitting in a PATH dir (directories are X_OK-searchable), producing a false "installed" in the picker. Unlikely but real; the SPEC says "an executable match". Verdict: suspicious-but-unproven in practice (minor false positive; fix: `stat` and require a regular file).
- **`detectEditors(probe)`** — concurrent probes, order-preserving filter. Correct.
- **`nodeSpawnRunner()`** — `spawn(command, args, { stdio: 'ignore', detached: true })`; resolves on `spawn`, rejects on `error`, `unref()` after launch. Edge: if the dynamic import rejected the promise would never settle — `node:child_process` cannot fail to load, noted only. Windows edge (real): most catalog editors install `.cmd` shims (`code.cmd`, `cursor.cmd` …), and on the supported Node (engines `>=22.12`) `spawn` of a `.cmd`/`.bat` without `shell: true` fails with `EINVAL` (the CVE-2024-27980 hardening). So on Windows the probe finds `code.CMD` via PATHEXT, the picker offers VS Code, and the open action then fails with a cryptic `spawn EINVAL` value. `explorer` (a real .exe) is unaffected. Verdict: bug found (Windows editor open).
- **`fileManagerCommand(path, os)`** — three-way switch. Correct.
- **`editorCommand(path, editor)`** — trims, falls back `$FRAMEWORK_EDITOR` → `code`. Whitespace-only preference falls back (tested). Correct.
- **`openInApp(cwd, target, agent, editor)`** — picks the command, awaits the runner, maps ENOENT to the friendly message, otherwise the error message; never throws. Correct.

## Bugs found

1. `L85` (`nodeSpawnRunner`, reached via `editorCommand`): opening a project in an editor on Windows fails with `spawn EINVAL` for `.cmd`-shimmed launchers. Scenario: Windows user with VS Code installed; `detectEditors` offers it (PATHEXT probe finds `code.CMD`); clicking "Open in editor" spawns `code` without a shell, which Node ≥ 22 refuses with EINVAL, so the user gets `{ ok: false, error: 'spawn EINVAL' }` — contradicting the SPEC's promise that the picker offers what will open, and the friendly-failure intent. Severity: minor (feature broken on one supported OS, error still surfaced as a value). Fix sketch: on win32 pass `shell: true` (path already the only arg; quote it) or resolve the launcher to its PATHEXT file and spawn `cmd.exe /c`.
2. `L53` (`nodeEditorProbe`): a directory on PATH named like a launcher (e.g. a folder `zed` inside a PATH dir) passes the POSIX `X_OK` access check and shows up as an installed editor. Severity: minor, low confidence in practice. Fix sketch: `stat` the candidate and require `isFile()` before reporting a hit.
