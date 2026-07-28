`makeEmitter` — wraps an engine's optional `onEvent` callback so progress reporting can never take a run down: a throwing callback is logged (`console.error`) and swallowed, and no callback at all becomes a no-op instead of a branch at every emit site.

## Decisions

- The `what` engine label is an explicit parameter because the call sites genuinely disagreed before extraction (bootstrap and overview named themselves in the log line, supervisor and loop did not); passing it in keeps each engine's message byte-identical (`[ai-autopilot] <what> onEvent callback threw; ignoring:` vs the unlabelled form) rather than quietly re-labelling two of them.
