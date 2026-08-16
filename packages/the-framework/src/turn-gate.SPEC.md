The turn-boundary contract with the wrapped agent: each turn runs as a black box, so everything the framework learns — the agent stopping to ask, views to show, its chosen session name, ready-for-merge — is a tagged block parsed out of the turn's final message.

## TLDR

- The protocol texts appended to the system channel pin how to emit, not when: blocking ask-gates (single choice, multi-select, plan approval, take over the browser) and non-blocking signals (markdown views, session name, ready-for-merge).
- Parsing is tolerant on purpose: a malformed block is ignored rather than crashing a run, the block appearing latest in the turn wins (falling back past a broken one), and missing ids and titles get sensible defaults.
- One continuation wording resumes the agent after any answered gate, and a shared cap on ask-rounds stops a run that keeps asking.
- Signal emission is deduped across a span of turns: ready-for-merge fires once, and a session name re-emits only on a real rename.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
