The usage panel's answers: where the account's quota stands, what the background PM last decided, and a way to make it sweep right now.

## User Stories

- The user reads where the account's quota stands — and a failed reading says so instead of drawing an empty bar.
- The user reads what the automatic PM last decided, project by project.
- The user makes the PM sweep right now instead of waiting for its next interval.

## Flows

- No reading is reported as no reading, never as an empty bar — an empty bar reads as "nothing used", the one thing this panel must never imply.
- What the automatic PM — the background project manager that starts unattended work — last decided is read beside the quota, since it spends against exactly that boundary; a loop with nothing to report yet reads as "nothing to say", never as an idle sweep.
- When the user fires a sweep by hand, it runs even with the automatic PM switched off: that preference is consent to spend quota unasked, and this click is asking. The call waits for the sweep and returns what it decided, project by project, so the card can say it without racing a poll — and the sweep can be narrowed to only working the queue.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
