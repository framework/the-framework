Runs the build spine's steps — build, review, improve — by prompting the wrapped agent, which is treated as a black box that does the actual work.

## TLDR

- The build is one prompt whose framing states the one thing the agent cannot infer: build from scratch in an empty workspace, or work within the codebase that already exists — an existing project is extended, never re-scaffolded.
- A build turn that leaves the workspace empty means the agent stalled: it is re-prompted once with a hard "create it from scratch" directive — unless it stopped on purpose to ask a question, which the ask-gate handles instead.
- There is no built-in review: each checklist pass fires the review chain of the domain preset the user opted into and blocks on the blockers those reviews report; a preset with no matching review blocks nothing. A review that failed to run counts as a blocker, so an errored review is never mistaken for a pass.
- Improve is a fresh prompt to clear exactly the current blockers (or to scaffold, when the workspace is still empty).

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
