The dashboard's settings: your global options, the repo's committed settings file, and the open project's own run options, resolved nearest-wins into the one value every control reads.

## TLDR

- Owned and persisted by the daemon, so settings follow the installation, not one browser.
- A change shows instantly and saves in the background; run options land on the open project while the rest stay global, so one repo's model choice does not follow you into the next.
- A write sends only the keys it changed and adopts the daemon's merged answer, so a stale tab can neither revert other people's changes nor keep showing them wrong.
- Returning to the tab re-reads every tier, making edits from another tab or from the repo's settings file on disk visible.
- Each control can also see which tier won its value — a repo-inherited value shows as not yours — and a project's shared, repo-committed custom presets ride along.
- The theme choice and the notification toggles read through here, with their defaults defined framework-side so daemon and dashboard cannot drift.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
