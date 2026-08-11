The end-of-session handoff riding the session's action bar: what this session left behind, and the next step offered rather than described.

## TLDR

- The one-line verdict beside the branch name: "branch gone", "no changes", or commits · files · diffstat, plus whether the work is already pushed or merged.
- While the agent works, one checkbox arms what happens at the end — ticked by default, so finished work stops arriving on a local branch nobody was told about. Its label always names exactly what this session will do (open a PR, open and merge, or push only), never something else; unticking it means the session hands off nothing.
- Once the session settles, the deliberate buttons take over: Open PR, or Merge for an open unmerged PR — but never while the PR lookup is still out, since acting on "not known yet" is how a second PR gets opened.
- When there is nothing to press, the reason is said in its place: branch gone, nothing committed (with the uncommitted files named), or no remote.
- The bar's disclosure expands into the commits, changed files and uncommitted files, capped with the remainder counted rather than dropped silently.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
