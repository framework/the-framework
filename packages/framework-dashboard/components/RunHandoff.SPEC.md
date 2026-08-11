The end-of-session handoff riding the session's action bar: what this session left behind, and the next step offered rather than described.

## TLDR

- The one-line verdict beside the branch: "branch gone", "no changes", or commits · files · diffstat, plus whether the work is already pushed or merged.
- While the agent works, one checkbox arms the ending — ticked by default, so finished work stops stranding on local branches nobody was told about. Its label names exactly what this session will do (open a PR, open and merge, or push only); unticked, nothing is handed off.
- Once it settles, deliberate buttons take over: Open PR, or Merge for an open unmerged PR — never while the PR lookup is still out, since acting on "not known yet" is how second PRs get opened.
- With nothing to press, the reason is said instead: branch gone, nothing committed (uncommitted files named), or no remote.
- The bar's disclosure expands into commits, changed and uncommitted files, capped with the remainder counted.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
