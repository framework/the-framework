Decides what a Discord message means for the project — pure rules, so every decision is testable without a connection, a daemon, or a live session.

## TLDR

- With nothing running, a message starts a session; with one live, it is passed to that session; small commands report status, stop the session, or print help.
- A session parked on a question is read answer-first: an option number, or an exact label or id, picks that option (a multi-select takes a comma list).
- Anything that is not a clean answer passes through as an ordinary message, and a partly-valid answer is rejected whole — picking an option on someone's behalf is worse than asking again.
- Every action carries the reply text to post, so the caller acts and acknowledges in one step.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
