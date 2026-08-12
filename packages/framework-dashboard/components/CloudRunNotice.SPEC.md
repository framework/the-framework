What the run view shows when the work was handed to a Claude web cloud session: where it went and how to reach it, plus — through the browser bridge — the question it is parked on and a mirror of its conversation.

## TLDR

- Nothing streams back from a cloud session, so instead of a feed that looks stalled the notice says the honest thing — the session asks its questions and opens its pull request over there — with a link out and the command that continues it on this machine.
- A question the bridge reports is answerable here as pick-then-confirm: the send has the extension type into the user's own Claude tab, so a queued answer can still be withdrawn, and a failed delivery says so and re-offers the question.
- The mirror is one clearly labelled box of what the Claude tab shows — a best-effort scrape kept visibly apart from the run's own durable log, with the site's UI chrome scrubbed out.
- Both pieces render nothing for any other run target, so run views mount them unconditionally.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
