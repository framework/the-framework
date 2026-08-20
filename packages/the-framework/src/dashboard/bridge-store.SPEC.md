The daemon's memory of the cloud-session bridge: each session's parked question and transcript, and the dashboard-picked answer on its way back.

## Flows

- One parked question per session, replaced when the session moves on; a new question also discards any undelivered answer to the old one, so a stale pick is never typed into a fresh question.
- An answer must be a label the question itself offered; once delivered it resolves the question, and re-reports of that question are ignored so it cannot resurface right after being answered. A failed delivery keeps the question for a retry.
- Acknowledgements name the answer they are about, so a stale one from a dead tab cannot resolve a newer answer.
- Transcript entries are kept one per position, bounded — the page is re-read constantly, so the same message arrives many times.
- Even refused contacts are remembered, telling a misconfigured extension apart from an absent one.

## Rationales

- The store is all in memory on purpose: a question is only answerable while its session is parked.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
