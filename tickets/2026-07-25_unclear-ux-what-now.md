Status: open
Priority: 8
Topics: [bug]
GitHub: [#1173](https://github.com/gemstack-land/the-framework/issues/1173)

# Unclear UX: what should I do now?

## TLDR

When an agent finishes, the next step is unclear. Partially fixed in #1178 (an "Open PR" button now appears once the agent settles, replacing the two checkboxes that sat there forever). Testing surfaced the next dead-end: pressing Open PR can fail with `GraphQL: No commits between main and <branch>` because the agent edited files but never committed — the branch has no diff to open a PR from. Direction settled in-thread: maximum autonomy — auto commit & push is safe (a branch is always created) and auto-opening a PR is what most users expect; take the quickest fix (e.g. always `[x] Open PR`), don't offer the button on a branch with no commits (say so and name the uncommitted work), and postpone any `Auto commit`/`Auto push` settings split unless it's a trivial quick-fix.

## Why it matters

Both reported sessions dead-ended after doing real work: the agent's edits were silently left uncommitted and the finished-session UI offered an action that couldn't succeed. This is the last mile of every session — if it fails, the whole run was wasted from the user's perspective. Priority high.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1173](https://github.com/gemstack-land/the-framework/issues/1173), created 2026-07-25, labels: `bug`, `priority: high`, 6 comments.

### Original description

The agent is finished, what should I do now?

<img width="1366" height="729" alt="Image" src="https://github.com/user-attachments/assets/cdf94a0c-c7df-44a6-b9ac-b0503ce3ee71" />

### Notes from the GitHub thread

- Shipped in #1178: the button appears once the agent settles, instead of the two checkboxes sitting there forever.
- Next failure found while testing: `Open PR` on a 0-commit branch fails (`No commits between main and ...`) because the agent never committed its edits. Follow-ups proposed: don't offer the button when there's no diff (say so, name the uncommitted work); have the agent handle uncommitted changes before settling; clean up the launcher gear (Push branch vs Open PR redundancy).
- Maintainer pushback on "the agent should ask whether to commit": the more autonomous the better — a branch is always created, so auto commit & push is safe, and auto-opening a PR is the expected default ("Can unattended runs commit automatically? Yes, and obviously so if `[x] Open PR`").
- Final direction: postpone the whole commit/push setting redesign (a possible future split: `[ ] Auto commit` + `[ ] Auto push`); take the quickest fix that makes the flow work, e.g. always `[x] Open PR`. If kept, the push button would be renamed `Commit & push` ("Commit the changes, and push commit to the remote repository") with setting `[ ] auto-push` ("Automatically commit & push changes").
