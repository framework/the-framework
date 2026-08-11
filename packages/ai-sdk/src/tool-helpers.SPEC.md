The shared building blocks of tool execution: driving any handler style uniformly, validating arguments, shaping what the model sees, and resolving approval.

## TLDR

- Any handler — plain value, promise, or progress-yielding generator — is driven the same way, so one tool definition works in both streaming and non-streaming runs.
- Arguments are checked against the tool's declared input before running; failures become a structured error fed back to the model so it can correct itself on the next turn.
- A tool's custom result-to-text transform must never crash the run: if it throws, the error is reported and the default stringification steps in.
- Approval resolves to allow, pending, or rejected by combining the tool's requirement (fixed or computed from the arguments) with the user's per-call decisions.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
