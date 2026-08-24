The greenfield build prompt: the opening prompt of a build agent whose workspace holds no app yet.

## Business logic

Sent as the opening prompt when the workspace holds no source at build time; the user's intent fills the `${{ tf.prompt }}` slot. The prompt file beside this spec is itself the prose of what the agent is told.

## Rationale

The stack is deliberately not prescribed — it is the agent's call.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
