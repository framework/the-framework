The daemon's memory of the cloud-session bridge: each session's parked question and transcript, and the answer the user picked on its way back.

## User Stories

- The user sees the question a cloud session is parked on right now, never one the session already moved past.
- The user's answer resolves the question once delivered — and only a label the question itself offered can ever be queued.

## Flows

- One parked question per session, replaced when the session moves on; a new question also discards any undelivered answer to the old one, so a stale pick is never typed into a fresh question.
- An answer must be a label the question itself offered. Once delivered it resolves the question, and re-reports of that question are ignored, so it cannot resurface right after being answered. A failed delivery keeps the question for a retry.
- Acknowledgements name the answer they are about, so a stale one from a dead tab cannot resolve a newer answer.
- Transcript entries are kept one per position, and bounded. The page is re-read constantly, so the same message arrives many times: each arrival replaces the copy at its position, which is also how a message still being streamed fills in.
- Even refused contacts are remembered, so the dashboard can tell the user a misconfigured extension apart from an absent one — both otherwise leave no question behind.

## Rationales

- The store is all in memory on purpose: a question is only answerable while its session is parked.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
