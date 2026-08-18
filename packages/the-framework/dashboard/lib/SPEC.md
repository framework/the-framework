The dashboard's client-side logic layer: the dashboard owns no facts of its own, and this is where the daemon's answers and an agent's event stream become everything the pages show — no components here, only the state and rules they consume.

## TLDR

- Freshness comes two ways: one live feed streams the selected agent's transcript (replay the log, then follow it, never showing less than it already showed), and everything else re-asks the daemon on short intervals. All reads share one guarded pattern — a failure keeps the last answer, a late answer for an abandoned target is dropped, absence is never claimed before the first answer — and a separate heartbeat is what turns "daemon unreachable" into a visible fact instead of silently frozen panels.
- Anything two surfaces show is computed once and shared so they cannot drift: an agent's options table with its cross-option rules, the one-word status pill, the status color vocabulary, agent and queue-entry labels, event badge wording, the quota week's bar arithmetic, and timestamp formatting that never shows a broken date.
- The URL is the selection — which view, project, and agent is open, and the whole tickets view (filters, sort, grouping) — so any state worth looking at is a link you can share, reload, and go Back from.
- Preferences live in the daemon and are cached here once for every reader, so a change made on one surface shows on all of them at once; the exception is saved remote devices, whose access tokens are per-browser secrets that never leave the browser except handed along per call.
- Attention plumbing keeps a backgrounded tab honest: browser notifications for new needs-you items and agent activity (sharing the daemon notifier's idea of "new"), the needs-you count folded into the tab title, and the tab icon animating while an agent works.
- Rules that can be pure are pure, wrapped thinly for the pages — so the behavior above is testable without a browser.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
