Posts one message to a Discord webhook, the transport both notification feeds share (the "needs you" interventions [1] in `interventions.ts` and the activity feed in `activity.ts`), and reports whether Discord accepted it. A message longer than Discord's 2,000-character limit is cut to fit and ends with "… (truncated)", so a shortened batch never reads as a complete one and never silently posts nothing; a refusal from Discord and a network failure both answer "not delivered" instead of throwing, so a failed delivery can only cost a log line in the daemon, never a crash of the watcher posting it.

## Glossary

[1] intervention: Something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.

## Business logic — TL;DR

- **Clamp to Discord's limit** - content over 2,000 characters is cut so that the message, including the appended "… (truncated)" marker, fits the limit.
- **One post, one verdict** - the message is posted once as JSON to the webhook URL, and "delivered" means Discord answered with a success status while any other status is "not delivered".
- **Failures never escape** - a network error answers "not delivered" too, nothing is retried here, and the caller decides what to log.
