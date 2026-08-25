# Bug analysis: packages/framework/src/install.ts

## Business logic (high-level)

Activation (#391): make a folder ready for agents in one readable commit. Steps: no-op if `.the-framework/.gitignore` (the activation marker) exists; `git init` when the folder is not a repo; commit pre-existing dirty work under its own message; create `.the-framework/` with ignore file + layout marker; materialize quality presets; `git add -A` + install commit. Failures are values (`{ok:false,error}`), never throws. Checked against `install.SPEC.md`:

- "Activation is one commit" — pre-existing work committed separately first, then one install commit. Matches.
- "The ignore file is the activation marker" — early return on its existence. Matches.
- "A folder that is not a repository becomes one" — rev-parse check with `.catch(() => false)` (so a non-repo *or* a missing git binary routes to `git init`; in the latter case init fails too and surfaces as the error value — acceptable). Reports `initialized: true`. Matches.
- "Activation never crashes" — whole body inside try/catch → error value. The one call *outside* the try is `fs.exists`, which by `StoreFs` contract never rejects. Matches.
- Presets regenerated per install, kept out of git — `materializePresets` runs after the ignore file is written, and the ignore's `*` keeps them unstaged; the final `add -A` therefore stages only `.gitignore` + `LAYOUT` from the new directory. Matches (#674 note: ticket-format spec deliberately not materialized).

Edge/failure analysis:

- **Fresh empty repo**: `status --porcelain` empty → no pre-commit; install commit has the two tracked files → succeeds. Good.
- **Dirty repo**: `add -A` + commit "[The Framework] uncommitted changes" — includes untracked files, which is the intent (install commit stays clean). Good.
- **Mid-install failure is not retryable** (found): the activation marker (`.gitignore`) is written *first* (L57), before the layout marker, presets, and the commit. If anything after L57 fails — disk full on L60, a failing pre-commit hook or missing `user.email` at L71 — the error is reported, but the marker now exists, so every retry returns `{ok:true, alreadyActivated}` while the repo is missing its LAYOUT (ungated!), presets, and install commit. The user is told "already activated" about a repo that half-is. Writing the marker last (or checking more than the marker) would make install re-runnable. Severity minor (requires a failure in the narrow window, but git commit failures — hooks, missing identity — are the *common* real-world failure here, not exotic).
- **User's root `.gitignore` ignoring `.the-framework/`**: `add -A` would stage nothing and the commit fails ("nothing to commit") → reported error, plus the same stuck-marker state as above. Defensive-input scenario; noted, not separately reported.
- **Concurrency**: two simultaneous installs could interleave (both pass the marker check) — activation is a user-initiated one-shot per project, not a concurrent path. Not a bug.
- **Anything else appearing between the status check and the final `add -A`** lands in the install commit — only reachable if something else writes the repo during activation, which nothing does.

## Functions (low-level)

- **`InstallResult` / `InstallDeps`** — outcome/value types; `alreadyActivated` and `initialized` optional flags, mutually exclusive by construction. Correct.
- **`installProject(cwd, deps)`** — walked above. Inputs: project root; injected `GitRunner`/`StoreFs` default to real ones. Output: result value. Verdict: correct except the marker-first ordering (bug 1).

## Bugs found

1. `L57`: The activation marker is written before the rest of activation, so any later failure (layout-marker write, preset write, the install commit itself — e.g. missing git identity or a failing hook) leaves the repo half-activated and *unrepairable by retry*: the next `installProject` sees the marker and no-ops with `alreadyActivated: true`, so the repo permanently lacks its layout gate (`LAYOUT`), presets, and install commit. Contradicts the SPEC's promise that activation leaves the repo "ready to run agents" with the three artifacts present. Severity: minor. Confidence: medium. Fix sketch: write `LAYOUT` and presets first and the `.gitignore` marker as the last fs step (order within the try is free), or make the already-activated check also verify `LAYOUT` exists.
