What the agent view shows when the work was handed to a Claude web cloud session: where it went and how to reach it, plus — through the browser-extension bridge that watches the user's own Claude tab — the question it is parked on and a mirror of its conversation.

## Flows

- Nothing streams back from a cloud session, so instead of a feed that looks stalled the notice says the honest thing — the session asks its questions and opens its pull request over there — with a link out and the command that continues it on this machine.
- A question the bridge reports is answerable here as pick-then-confirm: the send has the extension type the answer into the user's own Claude tab. Until the extension collects it, the queued answer can still be withdrawn; a failed delivery says so and re-offers the question.
- The mirror is one clearly labelled box of what the Claude tab shows — a best-effort scrape kept visibly apart from the agent's own durable log, with the site's UI chrome scrubbed out.
- Both pieces render nothing for any other target, so agent views mount them unconditionally.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
