The end-of-work handoff riding the agent's action bar: what this agent left behind, and the next step offered rather than described.

## Flows

- The user reads a one-line verdict beside the branch: "branch gone", "no changes", or commits · files · diffstat, plus whether the work is already pushed or merged.
- While the agent works, one checkbox arms the ending — ticked by default, so finished work stops stranding on local branches nobody was told about. Its label names exactly what this agent will do (open a PR, open and merge, or push only); unticked, nothing is handed off. Re-ticking arms the default action — open a PR — never a merge the box never mentioned, so the label and the outcome always agree.
- Once the agent stops working — even if its process stays alive awaiting a next message — deliberate buttons take over: Open PR, or Merge for an open unmerged PR. Neither is offered while the PR lookup is still out, since acting on "not known yet" is how second PRs get opened.
- With nothing to press, the user reads the reason instead: branch gone, nothing committed (uncommitted files named), or no remote.
- The bar's disclosure expands into commits, changed and uncommitted files, capped with the remainder counted.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
