How far a finished agent publishes itself — one ordinal covering keep it local, push the branch, open a pull request, merge it.

## Flows

- One ladder, not three switches. The stages are strictly nested — a pull request needs a pushed branch, a merge needs a pull request — so a rung includes every rung below it, and the impossible combinations are not representable.
- Unset means open a pull request: that is what makes the handoff zero-config, so work never sits on a local branch nobody is told about. Merging is the rung above, and landing on the default branch has to be asked for.
- A surface that offers the stages as three separate checkboxes converts both ways, and the conversion is where an impossible answer resolves *downward* rather than being quietly repaired upward.

## Rationales

- Three independent booleans describe eight states of which four are reachable, and the implication has to live in a doc comment because the type cannot carry it; the ladder carries the implication structurally.
- "A pull request without a push" is not something an agent can honour, and repairing it upward — turning the push back on — makes a "publish nothing" answer undeliverable; resolving downward keeps every answer deliverable.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
