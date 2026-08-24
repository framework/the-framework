The existing-codebase prompt: the opening prompt of a build agent whose workspace already holds source.

## Business logic

Sent as the opening prompt when the workspace already holds source at build time; the user's intent fills the `${{ tf.prompt }}` slot. The prompt file beside this spec is itself the prose of what the agent is told.

## Rationale

It names the one thing the agent cannot infer — that this codebase already exists — and nothing more: the how-to-behave rules it once carried (do not re-scaffold, read the existing code first, smallest coherent change set) were dropped as babysitting a capable agent, and it never suggests the workspace might be empty, because it is not.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
