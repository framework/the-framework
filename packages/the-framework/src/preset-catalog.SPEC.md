The one table of every built-in preset — the prompts the product offers as one-click runs, from quality reviews to the product-management cluster.

## TLDR

- The quality reviews (research, maintainability, readability, security audit, UX) take a target, defaulting to the launching session or the whole codebase.
- The PM cluster scopes itself to the repo's own tickets and queue: import and update tickets from GitHub, plan them, suggest new tickets or features, pick what to work on, triage into the queue, and drain the queue.
- Presets that pause for a human are kept off unattended schedules; the scheduled triage pair pins its own session name so a firing aborts instead of triaging twice.
- The two GitHub-import presets always open a session of their own — their work is about the repo, not the conversation they were clicked from.
- The launcher's menu is one ordered list here; the queue-drain preset is daemon-only and absent from it.
- Recognising "the prompt that drains the queue" compares against the rendered preset itself, so rewording the preset cannot silently break the detection.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
