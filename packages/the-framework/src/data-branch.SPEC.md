All the data The Framework writes — the tickets, the task queue, the session archives — lives on one dedicated branch, `tf-data`, so the code history stays 100% code and the data can be pushed and pulled eagerly without ever touching anyone's working tree.

## TLDR

- The branch is checked out at `.the-framework/branches/tf-data`, and a `tickets` symlink at the repo root points into it, so the roadmap stays one `ls` away. The symlink is hidden from git through a repo-level exclude, so no sweeping commit ever drags it onto a code branch.
- The daemon is the only local writer: every write is one serialized cycle — sync with origin, apply the change, commit, push — so a lost race re-reads the fresher state and re-applies the intent instead of clobbering what someone else landed.
- Every machine (and every cloud session) converges on the same data by pulling the branch eagerly; a write that cannot reach the network stays committed locally and rides out on the next cycle. The eager pull says when it could not converge — origin rejected the push, or the repository has no remote to converge with — because a data branch nobody else can reach is an error for the user to fix, not a mode.
- A project with the branch already on origin adopts it; a project without one births it with an empty history of its own, unrelated to the code's.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
