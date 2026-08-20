The dashboard's settings: your own options with the open project's committed settings file on top, resolved nearest-wins into the one value every control reads.

## Flows

- Owned and persisted by the daemon, so settings follow the installation, not one browser.
- Two tiers, one of them writable: a repo-shaped setting is edited in the repo, so every control writes to the same place and there is no split to get wrong.
- A change shows instantly and saves in the background; the write sends only the keys it changed and adopts the daemon's merged answer, so a stale tab can neither revert other people's changes nor keep showing them wrong.
- Returning to the tab re-reads both tiers, making edits from another tab or from the repo's settings file on disk visible.
- Each control can also see which tier won its value — a repo-inherited value shows as not yours — and a project's shared, repo-committed custom presets ride along.
- The theme choice and the notification toggles read through here, with their defaults defined framework-side so daemon and dashboard cannot drift.

## Rationales

- There is no third tier of your own per-project overrides: it would answer for one machine what the committed file already answers for everyone, and pay for it in a write split and per-tier write bookkeeping.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
