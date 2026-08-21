The one table of every built-in preset — the prompts the product offers as one-click agents, from quality reviews to the product-management cluster.

## User Stories

- The user picks a preset from the launcher menu — a quality review aimed at a target, or the PM cluster aimed at the repo's own tickets and queue — and gets an agent with no prompt to write.

## Flows

- The quality reviews (research, maintainability, readability, security audit, UX) take a target, defaulting to the launching agent or the whole codebase.
- The PM cluster scopes itself to the repo's own tickets and queue: update tickets from GitHub (an empty `tickets/` gets a full first import — there is no separate import preset), plan them, suggest new tickets or features, pick what to work on, triage into the queue, and drain the queue.
- Presets that pause for a human are kept off unattended schedules; the scheduled triage pair pins its own session name so a firing aborts instead of triaging twice.
- The GitHub-sync preset always opens an agent of its own — its work is about the repo, not the conversation it was clicked from.
- The launcher's menu is one ordered list; the queue-drain preset is daemon-only and absent from it.
- Recognising "the prompt that drains the queue" compares against the rendered preset itself, so rewording the preset cannot silently break the detection.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
