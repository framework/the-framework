Effort: 2
Uncertainty: 2

# [Plan] Codex cannot commit in a plain checkout: the default sandbox refuses writes under .git/

A concrete plan to let a Codex agent commit in a plain checkout: the driver adds the repository's git dir to the writable roots of the `workspace-write` sandbox.

## TLDR

`CodexSession.buildArgs()` (`packages/agent-driver/src/codex.ts:100-108`) gains one `-c sandbox_workspace_write.writable_roots=["<abs git common dir>"]` pair when the sandbox is `workspace-write` and the session's directory sits in a git repository. It stays one small change in one package: code, two tests, `codex.LOGIC.md` and `codex.test.LOGIC.md`. The ticket's reproduction (codex-cli 0.144.4) already proves the flag works.

## Considerations

- **Absolute path.** `git rev-parse --git-common-dir` prints the relative `.git` at a repository root. Use `git rev-parse --path-format=absolute --git-common-dir` (git >= 2.31), or resolve the output against `cwd`. Codex's writable roots need an absolute path.
- **Not a repository.** The driver passes `--skip-git-repo-check` because a workspace may not be a repository yet. When `git rev-parse` fails, or git is missing, omit the flag. The turn must never fail over this.
- **When to resolve.** Resolve at every `prompt()`, not at `start()`: an agent can `git init` during turn 1 and commit in turn 2. It costs one short `git` spawn per turn, which is negligible next to a Codex turn.
- **Sandbox modes.** Add the flag only for `workspace-write`. `read-only` must stay read-only, and `danger-full-access` has nothing to widen.
- **Worktrees.** In a worktree the common dir is the parent's `.git/`, which already works today (see the ticket). Passing it anyway is harmless and keeps one code path; do not special-case worktrees.
- **Sync vs async.** `buildArgs()` is synchronous and `prompt()` returns `runCliSession(...)` directly. Either use `execFileSync('git', [...], { cwd, stdio: ['ignore','pipe','ignore'] })` with try/catch, or make `prompt()` async and await an `execFile`. Recommendation: async `execFile`, so the daemon's event loop never blocks. If that makes the code less readable, sync is acceptable: it is a millisecond call.
- **Testability.** Tests spawn Codex through an injected `spawn`, and `/ws` is not a repository, so the existing exact-args test (`codex.test.ts:138`) stays green unchanged. That test is also the "not a repository → no flag" case. Add a test that runs `git init` in a `mkdtemp` dir and asserts the `-c` pair carries that dir's absolute `.git` (use `realpath` because macOS `/var` → `/private/var`). Add a second test asserting `read-only` gets no flag. Following the repository's "verify a test by breaking it" habit, drop the flag once and watch the new test fail.
- **TOML quoting.** The `-c` value is parsed as TOML. Build it with `JSON.stringify([dir])`: a JSON string array is a valid TOML array for ordinary paths, and a backslash or quote gets escaped the same way in both.
- **extraArgs.** `extraArgs` is appended after the flag, so a caller's own `-c sandbox_workspace_write.writable_roots=...` overrides ours (the last `-c` wins; arrays replace, they do not merge). Say so in the option's doc comment. Do not try to merge.
- **Security surface.** A writable `.git/` lets the agent write `.git/hooks/*` and `.git/config`, which run later outside the sandbox (e.g. when a human commits). The worktree case already allows this today, and committing is the agent's job, so accept it. Note it in the "why" comment and in LOGIC.md rather than trying to narrow the root to `objects/refs/index`: git needs lock files in several places, and that list would be brittle.
- **Docs.** Update `codex.LOGIC.md` ("Sandboxed to the directory", codex.LOGIC.md:50-58) and `codex.test.LOGIC.md:6` (read the `logic-driven-development` skill first). Extend the `CodexSandbox` doc comment (codex.ts:6-12) with why the git dir is writable. No FEATURES-SPEC.md change: it is a bug fix, not a feature.
- **Caller.** The only in-repo caller is `packages/framework/src/driver-cli.ts:100` (`new CodexDriver()`). It needs no change.

## Alternatives (rejected)

- **Resolve in the caller** (framework passes the dir through `extraArgs`): every caller would have to know about Codex's sandbox quirk. The bug belongs to the driver.
- **Add `cwd/.git` only when it is a directory:** saves one git call but misses `GIT_DIR` layouts and separate-git-dir clones. The `git rev-parse` call is just as simple and exact.
- **`danger-full-access` by default:** rejected by design (codex.ts:6-12, never widen past the workspace).

## Implementation

1. `codex.ts`: add a helper `gitCommonDir(cwd): Promise<string | undefined>` (execFile `git rev-parse --path-format=absolute --git-common-dir`, trimmed, `undefined` on any error). Make `prompt()` async and `buildArgs(gitDir)` take the result. When the sandbox is `workspace-write` and `gitDir` is set, push `-c`, `sandbox_workspace_write.writable_roots=${JSON.stringify([gitDir])}` after `-C <cwd>` and before `-m`/`extraArgs`. Add a short "why" comment: plain checkout, `.git/index.lock` refused, verified on codex-cli 0.144.4, #1747.
2. `codex.test.ts`: the git-repo test and the read-only test described above. The existing tests stay unchanged.
3. `codex.LOGIC.md` + `codex.test.LOGIC.md`: one paragraph each, per the LDD skill.
4. `pnpm --filter agent-driver test` green. Optional manual proof: a real `codex exec` in a plain `git init` temp repo commits. It costs a Codex turn, so skip it if there is no subscription.
5. PR closes #1747. Then `npx tickets close 2026-08-29_codex-commit-plain-checkout.md`.
