# Bug analysis: packages/framework/src/project-presets.ts

## Business logic (high-level)

Project-tier custom presets (#1025): a JSON array of `CustomPreset` committed at `.the-framework/custom-presets.json`, sharing the shape and sanitizer of the user tier (`sanitizeCustomPresets` from `registry.ts`). Per `project-presets.SPEC.md`:

- **Reading never fails** — missing/unreadable file → `[]`; unparseable JSON → `[]`; malformed entries dropped by the sanitizer. Both failure paths have their own try/catch, so a read error is not conflated with a parse error. Correct.
- **Saving keeps the file committable** — mkdir (recursive `StoreFs.mkdir`), append `!custom-presets.json` to `.the-framework/.gitignore` unless present, sanitize, write pretty JSON + trailing newline. Gitignore semantics check: the install-written file is `*` / `!.gitignore` / `!LAYOUT`; appending the negation *after* the `*` is what makes it effective (last match wins). Verified `install.ts` writes the gitignore only when the activation marker is absent (early `alreadyActivated` return), so a later re-install cannot clobber the appended negation.
- **Empty list keeps the file** — `writeProjectPresets(cwd, [])` writes `[]\n` rather than deleting, preserving the negation and the tracked file (pinned by the test).
- **Pre-install save** — no gitignore yet: `ensureGitignoreNegation` swallows the read error and writes a bare negation file; harmless until install adds the `*` (documented, and install skips gitignore creation only post-activation — a pre-activation dir with only this file still lacks the marker? No: the marker *is* `.the-framework/.gitignore`. A pre-install `writeProjectPresets` therefore creates the activation marker file with only the negation in it, making `isActivated` read true and install's no-op check skip writing the real `*` ignore. See Bugs below.)

Concurrency: two overlapping saves can both miss the existing negation and append it twice (read-check-append race; nothing serializes these writes, unlike `registry.ts`'s funnel). Duplicate negation lines are functionally inert for git and the file converges; cosmetic only — noted, not reported.

## Functions (low-level)

- **`PROJECT_PRESETS_FILE`** — `.the-framework/custom-presets.json`, forward-slash constant joined under cwd at use. Correct.
- **`readProjectPresets(cwd, fs)`** — two-stage forgiving read, then sanitize. Returns sanitized copies (trimmed), so a caller mutating the result cannot corrupt anything. Correct.
- **`writeProjectPresets(cwd, presets, fs)`** — mkdir → ensure negation → sanitize → write. Sanitizing on write keeps the committed file well-formed even for hostile input (length caps, dedupe by id, cap 30 — from `registry.ts`). Correct.
- **`ensureGitignoreNegation(cwd, fs)`** — line-wise check with `trim()` (tolerates CRLF / stray spaces); appends with newline handling for a file not ending in `\n`. Verdict: correct in isolation; see the pre-install interaction below.

## Bugs found

1. `L71-L83` (`ensureGitignoreNegation`, with `project.ts`/`install.ts` as context): saving a project preset into a **not-yet-installed** repo creates `.the-framework/.gitignore` containing only `!custom-presets.json` — but that exact file is the activation marker (`isActivated`, `project.ts` L32-34) and install's own no-op check (#1600). A subsequent install then reads the repo as already activated and never writes the real `*` ignore (nor the layout marker/presets, `install.ts` returns `alreadyActivated` early), so every transient framework file (`events.jsonl`, `agent.json`, worktrees under `branches/`) becomes visible to git in that repo. The code comment claims the bare negation "self-heals when install adds the rest", but install keys on the file's existence, not its content, so it never adds the rest. Trigger: dashboard "save shared preset" on a registered-but-not-installed project, then install. Severity: minor (needs the pre-install save path to be reachable from the UI; if the dashboard only offers preset-saving on activated projects, the branch is dead code and the comment is merely wrong). Fix sketch: in `ensureGitignoreNegation`, when the read fails (no `.gitignore`), write the full `frameworkGitignore()` content plus the negation instead of the bare negation — or have `writeProjectPresets` refuse/skip on a non-activated project. Confidence: low (depends on whether any caller writes pre-activation).
