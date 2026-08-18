The extension's daemon half: the only part holding the bridge token and talking to the local dashboard — it forwards what the page half finds, delivers the dashboard's answers into the right tab, and keeps a pinned tab open per watched session.

## TLDR

- The token and every daemon call live here: the page half shares a tab with claude.ai and must never see the secret, and the daemon refuses cross-origin requests on purpose — only this half is exempt.
- Questions forward with a dedupe: the page re-reports on every change, and an unchanged question for the same session costs nothing.
- Answers travel back: queued picks are fetched on a fast beat (a person is watching a spinner), handed to the page in that session's tab to type, and the outcome reported — typing before reporting, so a pick is never marked sent that a dying tab never typed; failed deliveries and reports are retried, not dropped.
- One pinned, inactive tab opens per session the daemon says to watch — the extension cannot know on its own that a cloud agent started; stale ones close, and a tab the user closed is never reopened.
- Every sweep records why it did or didn't act, so "tabs are not opening" is answerable from the options page.
- Every daemon call states this extension's version; a daemon expecting another refuses outright with both versions named, so a stale install blocks loudly instead of half-working.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
