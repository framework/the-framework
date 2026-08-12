The shared defaults and bounds for user preferences, written down once so the dashboard and the daemon act on the same values.

## TLDR

- Names which preference keys a project may override — the user's per-project choices (model, agent, automation and publishing behavior), kept in the user's home file rather than the repo so one machine's choices are not imposed on everyone who clones it.
- Notification polarities: the "needs you" alerts fire unless turned off, while anything that reaches outward (Discord) or acts on what it reads (the chatbot) is opt-in; Discord delivery requires both the method and the category to be on.
- The bounds and defaults for the automatic-spend slider and the auto-PM concurrency — one number each that both the browser control and the daemon's sanitizer read.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
