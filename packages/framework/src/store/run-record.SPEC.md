The framework's run in the `logs` skill's two shapes, both ways: the agent meta as the run's card and back, the event log as the run's diary and back.

## Context

The `logs` skill owns what a run says to an agent: a card of eleven plain fields and four kinds of diary line. The framework records far more about a run than that, and none of it is the skill's to know. So the framework keeps its own fields inside the skill's files, in the places the skill stores and never reads, and every reader of a recorded run comes back through this mapping — the run page's replay, the tail of an ended run, a continuation's restore, the boot-time healing.

## Business logic — TL;DR

- **The card** - the agent meta's id, start and end time, status, intent, driver, model, branch, pull request, ticket and cost are the card's own fields; every other field of the meta sits under the one key the skill keeps for its caller. A card unfolds back into the meta with the skill's fields winning; a card with no caller at all gets a last-updated time from its end or its start.
- **The diary** - what the agent said, its result, the run's cost and its ending are written as the skill's four kinds of line, their other fields carried along; every other event is written as it is, under its own kind. A diary reads back as the same events, a line of any other kind passing through untouched.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
