Persists a paused top-level agent run — parked on a client tool or an approval gate — so a later request can resume it where it left off.

## TLDR

- A snapshot carries the whole conversation so far, the tool calls being waited on, which kind of pause it is, progress totals, and opaque host metadata.
- Reads come in two flavors: a peek that leaves the snapshot in place (to render a waiting view) and a single-use consume, so a replayed or forged run id can never be redeemed twice.
- Run ids are unguessable on purpose — holding one is the capability to resume the conversation.
- Two bundled backends: in-memory for tests and single-process dev, and one over any app-supplied cache (the SDK bundles none); snapshots expire after a few minutes so abandoned runs clean themselves up.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
