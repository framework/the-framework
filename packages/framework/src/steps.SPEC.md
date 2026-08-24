The opening prompt of a build agent, filled with the user's intent.

## Business logic

A build agent's opening prompt is the existing-codebase framing — a project is a repo that already exists, so there is exactly one framing. Its text is authored as markdown in the prompts directory like every other agent-facing prompt; what happens here is only filling in the intent. The old greenfield and scaffold-retry framings (build an app in an empty folder) were removed: no product path leads a build agent into an empty workspace any more.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
