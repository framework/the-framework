---
'@gemstack/the-framework': patch
---

Never silently downgrade a run into your own checkout when its worktree could not be created (#997).

Every run gets its own git worktree (#736) so the agent never edits the working tree you are sitting
in. When `git worktree add` failed, the daemon logged a line and ran the agent in the project's main
checkout instead, mixing its edits into your uncommitted work. That is reachable in normal use: on a
large repo `worktree add` writes a whole checkout and can outrun its budget and be killed.

A project that is not a git repo still falls back to the main checkout, which is the supported
pre-#736 behavior. A project that *is* a repo and whose `worktree add` failed now fails the Start
instead, and the dashboard shows why. A failed Start is recoverable by starting it again; a checkout
with agent edits mixed into it is not.

A `worktree add` killed mid-write leaves the partial checkout it had already written behind (git
drops its own administrative entry on the way out, so `git worktree prune` finds nothing to do), so
that directory is now removed on the timeout path.

The fallback's log line also says which case it is: "is not a git repository, so it gets no
worktree" rather than a generic "no worktree" that read the same either way.
