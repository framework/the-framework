The dashboard's settings: your own options with the open project's committed settings file on top — where both set a key the project file wins — resolved into the one value every control reads.

## Flows

- Owned and persisted by the daemon, so settings follow the installation, not one browser.
- Two tiers, one of them writable: the dashboard writes only your own options — the project's committed file is edited in the repo — so every control writes to the same place and there is no split to get wrong.
- A change shows instantly and saves in the background; the write sends only the keys it changed and adopts the daemon's merged answer, so a stale tab can neither revert other people's changes nor keep showing them wrong.
- Returning to the tab re-reads both tiers, making edits from another tab or from the repo's settings file on disk visible.
- Each control can also see which tier won its value, so a repo-inherited value shows as not yours.
- A project's shared custom presets — committed into the repo, so everyone who clones it sees them — load and save through the same cache.
- The theme choice and the notification toggles read through here; the notification defaults are defined framework-side so daemon and dashboard cannot drift, while the theme's default lives here — absent means follow the OS.

## Rationales

- There is no third tier of your own per-project overrides: it would answer for one machine what the committed file already answers for everyone, and pay for it in a write split and per-tier write bookkeeping.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
