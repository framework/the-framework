The existing-codebase prompt: the opening prompt of a build agent whose workspace already holds source.

## Business logic

It names the one thing the agent cannot infer — this codebase already exists — and the work to deliver, then asks for a one-paragraph summary of what changed. Nothing more: the how-to-behave rules it once carried (do not re-scaffold, read the existing code first, smallest coherent change set) were dropped as babysitting a capable agent, and it never suggests the workspace might be empty, because it is not.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
