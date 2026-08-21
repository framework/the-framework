Browser notifications for the two watched feeds: something new needs you, or an agent started or finished.

## Flows

- What counts as "new" is the same logic the daemon's own notifier runs — identity and baseline both — so the browser and the other delivery channels can never disagree about which items were already announced.
- A project's backlog is absorbed as a baseline the first time the dashboard reads that project completely: you hear only what happens while you are watching, never what was already there — and flipping the toggle does not replay it either.
- A feed that came back empty because the daemon could not reach that project is not a baseline. A dashboard opened while GitHub is unreachable therefore stays quiet when GitHub comes back, instead of announcing everything already waiting as if it had just arrived.
- It stays silent unless the user turned it on and the browser granted permission.
- A click on a PR opens it on GitHub; everything else lives in this dashboard, so the click just brings the tab forward.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
