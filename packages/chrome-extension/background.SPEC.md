The extension's daemon half: the only part holding the bridge token and talking to the local dashboard — it forwards what the page half finds, delivers the dashboard's answers into the right tab, and keeps a pinned tab open per watched session.

## Flows

- Questions forward with a dedupe: the page half re-reports on every page change, and an unchanged question for the same session is not re-sent to the daemon.
- Answers travel back: each answer the user picks in the dashboard is queued at the daemon, fetched on a fast beat, and handed to the page half in that session's tab to type, and the outcome is reported back. Typing comes before the report, so an answer is never marked sent that a dying tab never typed. Failed deliveries and failed reports are retried, not dropped.
- One pinned, inactive tab opens per session the daemon says to watch; a tab whose session is no longer watched closes, and a tab the user closed is never reopened.
- Every sweep — each pass that opens and closes these tabs — records why it did or didn't act, so "tabs are not opening" is answerable from the options page.
- Every daemon call states this extension's version; a daemon expecting another refuses outright with both versions named, so a stale install blocks loudly instead of half-working.

## Rationales

- **The token and every daemon call live here.** The page half shares a tab with claude.ai and must never see the secret, and the daemon refuses cross-origin requests on purpose — only this half is exempt.
- **Answers are fetched on a fast beat.** A person is sitting on the other end of a delivery, watching a spinner that says the pick is on its way.
- **The daemon names the sessions to watch.** The extension cannot know on its own that a cloud agent started — it only sees pages it is already injected into.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
