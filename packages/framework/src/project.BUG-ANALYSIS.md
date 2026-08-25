# Bug analysis: packages/framework/src/project.ts

## Business logic (high-level)

Read-only project/repo helpers (#380/#997): the activation check, the `git ls-files` crawl, `isGitRepo`, and — the meat — the per-subcommand git timeout policy behind `nodeGitRunner()`. Checked against `project.SPEC.md`:

- **Activation** — `isActivated` = existence of `.the-framework/.gitignore` (`gitignorePath`), the same marker install writes and checks (#1600). A bare `.the-framework/` dir does not count. Matches SPEC. (Note: `writeProjectPresets` can mint this marker pre-install — recorded in `project-presets.BUG-ANALYSIS.md`, fix belongs there.)
- **Timeout classes** — reads 10s, local mutations 30s, network/whole-checkout 120s. Classification: leading global options skipped (value-taking ones skip their value), then flags filtered out; `worktree` gets a sub-decision (`add` slow, `list` read, else write); unknown/empty → write. The SPEC's rationale (a SIGTERM'd `worktree add`/`push` is destructive) is served: both land in the slow class, including behind `-C`/`-c`/inline `--opt=value` forms.
- **Crawl** — `ls-files -z --cached --others --exclude-standard`, split on NUL, deduped, sorted; any failure → `[]`. Matches SPEC ("what git sees", forgiving).
- **`isGitRepo`** — `rev-parse --is-inside-work-tree` === 'true'; any failure → false. Deliberately conservative direction (SPEC).

Edge cases examined:

- `gitWords` with `['-C','/repo','-c','a=b','push']` → skips 2+2, finds `push`. With a value-taking option at the end (`['-C']`) → `i` runs past the array, `slice` yields `[]` → write budget; harmless.
- Post-subcommand option *values* stay in `words` (e.g. `-b <branch>` keeps `<branch>`), but only `words[0]`/`words[1]` are consulted and the flag itself is filtered, so `worktree add -b x` still reads `add` at index 1. Verified against every real call shape in the test's #997 inventory.
- `GIT_READ_OPS` contains `branch` and `remote`, though `git branch <name> <start>` (used by `data-branch.ts` to create `tf-data`) and `git remote add` are writes. Consequence is only a tighter 10s budget on sub-second ref/config writes — semantically misclassified but harmless in practice; noted, not reported.
- Unlisted value-taking globals (`--config-env`, `--super-prefix`) would misparse, but no call site uses them (relied upon, per instructions).
- `crawlRepoFiles` trims each NUL-separated entry. The trim exists to drop the empty entry after the trailing NUL, but `''` is already falsy — and the trim also mutates real path bytes: a repo file named with leading/trailing whitespace (legal on Linux; probed: `" lead.ts"` → `"lead.ts"`) is reported under a path that does not exist, and a whitespace-only name vanishes. See Bugs.
- 16MB `maxBuffer`: a gigantic repo overruns → ENOBUFS → `[]` (the `cliRunner` maps only killed-without-ENOBUFS to `CliTimeoutError`). Forgiving per SPEC; fine.

## Functions (low-level)

- **`nodeProjectFs`** — narrows `nodeFs()` to `exists` (file-only stat). Correct.
- **`isActivated(cwd, fs?)`** — one existence probe. Correct.
- **`GIT_READ_TIMEOUT_MS` / `GIT_WRITE_TIMEOUT_MS` / `GIT_SLOW_TIMEOUT_MS`** — 10s/30s/120s, pinned by tests so they cannot silently collapse. Correct.
- **`gitWords(args)`** — leading-globals skip + flag filter; `args[i] ?? ''` guards `noUncheckedIndexedAccess`. Correct for all real call shapes.
- **`gitTimeoutMs(args)`** — slow set → 120s; `worktree` sub-decision; read set → 10s; default 30s. Correct.
- **`nodeGitRunner()`** — `cliRunner({ bin: 'git', timeoutMs: gitTimeoutMs, maxBuffer: 16MB })`; rejects `CliTimeoutError` on timeout kill (verified in `cli-exec.ts`). Correct.
- **`isGitRepo(cwd, agent?)`** — trim-compare, catch → false. A bare repo prints 'false' → false, which is right (cannot host worktrees the framework way). Correct.
- **`crawlRepoFiles(cwd, agent?)`** — see edge above. Verdict: bug found (minor).

## Bugs found

1. `L145-L147` (`crawlRepoFiles`): `entry.trim()` corrupts legal filenames. `git ls-files -z` emits raw path bytes with **no** trailing-whitespace escaping, so a tracked/untracked file named e.g. `"draft .md "` or `" notes.txt"` is reported with the whitespace stripped — a repo-relative path that does not resolve (dashboard sidebar entry opens nothing), and a whitespace-only name is silently dropped. The trim's only legitimate job — dropping the empty entry after the final NUL — is already done by the falsiness check. Contradicts the SPEC's "repo-relative paths ... as the user perceives it". Severity: minor (pathological but reachable names in user repos). Fix: `for (const entry of out.split('\0')) if (entry) files.add(entry)`.
