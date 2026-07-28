Promotes the agent queue (`TODO_AGENTS.md`) from a finished run's worktree branch into the project checkout, and decides which queue entries are already claimed by a run (#852, #1204, #1253, #1313).

## TLDR

- `promoteQueue()`: copies `TODO_AGENTS.md` from a finished run's branch into the project checkout and commits only that pathspec; skips (with a prose reason) whenever anything is unexpected.
- `landPinnedEntry()`: for a run pinned to one queue entry, merges only that entry's check-off plus follow-ups the run added — never a wholesale file copy.
- `entriesRetiredByPatch()`: reads an open PR's unified diff of the queue file to tell which entries the PR retires (adds checked, or removes open without re-adding).
- `claimedQueueEntries()`: which candidate entries are claimed by run metas (running, or done with an open PR) or by another machine's open-PR queue diff — so auto PM never double-assigns.
- The daemon runs this, not the agent: agents stay sandboxed in worktrees with no write access to the checkout.

## Problems

- Runs happen in their own git worktree (#736), which forks the shared-mutable queue file: a run's perfectly good queue landed on a branch nobody reads, so auto PM kept re-deriving the same entries forever, spending quota each cooldown (#852).
- With several drains in flight, a wholesale copy would carry each run's stale view of every *other* entry — the last promotion of a tick would un-check what earlier ones just retired (#1204).
- An entry present on the branch but absent in the checkout is ambiguous: added by the run, or removed by a human meanwhile (removal is the format's way to retire an entry). The merge base disambiguates; with no merge base, additions are dropped rather than resurrecting struck-off work.
- The in-memory pin dies with the daemon, and a hands-off web run's local process ends at the hand-off while the cloud session still works its entry — both would put the entry back on the market (#1253). Run metas (and open PRs) are what survive.
- Another daemon's drain or a cloud session is invisible to this machine's run metas; its open PR's queue diff is the cross-machine claim signal (#1313).

## Decisions

- Conservative everywhere it is not certain: a skipped promotion costs one idle cycle; a wrong one touches a repo a human is working in. Never throws (runs on a background tick).
- A dirty queue file in the checkout means a human is mid-edit: skip with `retry: true`. The machine-readable `retry` flag exists because the daemon used to string-match the prose reason, where a copyedit would silently flip "retry next tick" into "settled forever".
- `landPinnedEntry` is additive by construction (only checks a box or appends a line, never unchecks/removes/reorders), so two concurrent drains compose in either order; the worst wrong guess leaves a duplicate line, not redone work.
- `entriesRetiredByPatch` reads diff lines, not whole files: an entry merely absent on a branch that forked before the entry was added must never count as retired. A remove-and-re-add-open pair (formatting shuffle) cancels out.
- A PR lookup still warming counts as claimed (for pending per-run PR lookups, and for a pending cross-machine patch lookup, which claims *everything* for one tick): handing an entry out because the answer was slow is the exact double-assignment this prevents.
- Failed/stopped runs and closed-unmerged PRs release the claim: that work was abandoned.
- Uses `git checkout <branch> -- <path>` (write + stage in one step) and pathspec-scoped `git commit -- <path>`, so whatever else is staged in the user's checkout never rides along.

## Facts

- Commit message: `[The Framework] queue updates from <runId>` (`promotionMessage`).
- `ENTRY_LINE` regex accepts `-`, `*`, or `1.` list items with an optional `[ ]`/`[x]` checkbox — the same grammar as `parseTodoEntries`; "open" = any list item whose checkbox is not ticked (#1164/#1297).
- `QueueClaimDeps.queuePatches` absent means claims stay local-only — the graceful shape for a repo with no remote or no `gh`.

## Flows

- promote (wholesale): `git show branch:TODO_AGENTS.md` → compare with `HEAD:` copy → dirty check → `checkout branch -- file` → pathspec commit.
- promote (pinned entry, #1204): merge-base → file at base → `landPinnedEntry(checkout, branch, entry, base)` → write + add + pathspec commit.
- claim check: run metas filtered to candidates → running claims / done+open-PR claims (pending = claimed) → open-PR queue patches → `entriesRetiredByPatch` per patch.
