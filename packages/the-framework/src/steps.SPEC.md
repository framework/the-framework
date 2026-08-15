Runs the build step by prompting the wrapped agent, which is treated as a black box that does the actual work.

## TLDR

- The build is one prompt whose framing states the one thing the agent cannot infer: build from scratch in an empty workspace, or work within the codebase that already exists — an existing project is extended, never re-scaffolded.
- A build turn that leaves the workspace empty means the agent stalled: it is re-prompted once with a hard "create it from scratch" directive — unless it stopped on purpose to ask a question, which the ask-gate handles instead.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
