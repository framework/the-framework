Debounced, path-scoped git committer that lands daemon-recorded conversations (#912) and archived session files (#1179) from a project's main checkout into its git history.

## TLDR

- Scope is exactly two pathspecs (`COMMITTED_PATHSPECS`): `.the-framework/conversations` and `:(glob).the-framework/*/sessions/**` — never `git add -A`, so the user's in-progress work and staged index are untouched.
- `startConversationCommitter` polls every project each `COMMIT_POLL_MS` (30s); a project whose pending-file fingerprint is byte-identical across two polls is "settled" and committed; `COMMIT_MAX_WAIT_MS` (5min) forces a never-idle conversation through.
- `commitConversations` first checks `gitBusy` (index.lock, rebase/merge/cherry-pick/revert/bisect markers) and skips rather than commit into someone else's operation; failures are outcomes, never throws (runs on a background tick with nothing to catch).
- `flush()` commits every project now, skipping the idle window — for daemon shutdown.
- `commitMessage` names what moved; sessions counted per run, not per file (one run = a `.json` + a `.jsonl`, and "2 sessions" for one would be a lie).

## Problems

- `git add`/`commit` are all-or-nothing about pathspecs: one matching no files aborts the whole command, so `pathspecsFor` drops patterns with nothing pending — every project until its first chat would otherwise fail on every poll. The two failure sites differ: `add` tolerates an existing-but-empty dir, `commit` then rejects it.
- `git status` collapses a wholly-untracked directory into one `??` entry by default, so `-uall` is load-bearing: without it the fingerprint is identical whether one conversation or ten are being written, and the debounce would commit straight through a burst.
- The busy check resolves the git dir via `rev-parse --absolute-git-dir` rather than assuming `<cwd>/.git`, so it is right in a linked worktree where `.git` is a file pointing elsewhere.
- An empty resolved-pathspec list would mean "everything" to git and sweep the whole checkout into our commit — it reads as nothing-pending instead.

## Decisions

- Debounced on an idle window rather than committed per chat turn: turns are seconds apart and a commit each would bury the project's real history under transcript noise.
- `Pending.since` deliberately survives a changing fingerprint — that is what makes the max-wait cap reachable; a conversation written every poll would otherwise reset its own clock forever.
- Tolerates not being alone despite the one-daemon-per-machine rule (#393), so #605's eventual answer on who owns the chat bot cannot invalidate this: locked/busy repos are skipped, failed commits swallowed and retried next window.
- Failure reasons are logged on change only, so a stuck project logs once, not every poll.
- `SESSIONS_PATHSPEC` uses `:(glob)` magic so `*` stops at path separators; its trailing `/**` is load-bearing and its absence silent — glob magic matches whole file paths, so a bare directory pattern matches no file and `git add` fails every time.

## Facts

- `pendingConversations` parses `--porcelain` v1 (fixed-width status columns, path starts at column 3); renames report the destination; C-style-quoted paths are unquoted (only the escapes git actually emits).
- `PATHSPEC_MEMBERSHIP` (which pending file belongs to which pathspec) is kept beside the pathspecs themselves — a drifted predicate would silently drop files from every commit.
- Commit messages are prefixed `[The Framework]`.

## Flows

- poll: `projects()` → per project `pendingConversations` (status, scoped, `-uall`) → fingerprint settled or max-wait exceeded? → `commitConversations` (`gitBusy` → `add -- <pathspecs>` → `commit -m … -- <pathspecs>`) → log on success / retain state on failure; state for vanished projects dropped.
- shutdown: daemon stops the timer → `flush()` commits every project immediately.
