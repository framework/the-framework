The scaffold retry prompt: the hard directive sent when a build's opening turn left the workspace empty.

## Business logic

Sent as a retry when the opening build turn produced no source — the agent stalled waiting for code that does not exist, or refused because the directory is empty; the user's intent fills the `${{ tf.prompt }}` slot. The prompt file beside this spec is itself the prose of what the agent is told.

## Rationale

Its insistence that an empty directory is expected — not a reason to refuse or wait — exists because that stall is exactly how the failed builds looked.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
