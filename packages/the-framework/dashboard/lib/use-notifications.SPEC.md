Browser notifications for the two watched feeds: something new needs you, or an agent started or finished.

## TLDR

- What counts as "new" is the same logic the daemon's own notifier runs, so the browser and the other delivery channels can never disagree about which items were already announced.
- The first observations after load are absorbed as a baseline: you hear only what happens while you are watching, never the backlog that already existed — and flipping the toggle does not replay the backlog either.
- It stays silent unless the user turned it on and the browser granted permission.
- A click on a PR opens it on GitHub; everything else lives in this dashboard, so the click just brings the tab forward.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
