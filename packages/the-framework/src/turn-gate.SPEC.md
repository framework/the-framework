The turn-boundary contract with the wrapped agent: each turn runs as a black box, so everything the framework learns — the agent stopping to ask, views to show, its chosen session name, ready-for-merge — is a tagged block parsed out of the turn's final message.

## TLDR

- The protocol texts appended to the system channel pin how to emit, not when: one blocking ask-gate and the non-blocking signals (markdown views, session name, ready-for-merge).
- There is one gate block, not four. A single choice, several at once, an approval, and handing over a browser were four tags with four parsers; each is a question with options, and what distinguishes them is what the agent writes in one — two options for an approval, a file for a plan, a flag for several picks, a mark on the options that end the agent rather than resuming it. A new kind of question needs no new code.
- Parsing is tolerant on purpose: a malformed block is ignored rather than crashing an agent, the block appearing latest in the turn wins (falling back past a broken one), and missing ids and titles get sensible defaults. A block with nothing pickable in it is not a gate — the agent carries on rather than parking on an empty question.
- One continuation wording resumes the agent after any answered gate, and a shared cap on ask-rounds stops an agent that keeps asking.
- Signal emission is deduped across a span of turns: ready-for-merge fires once, and a session name re-emits only on a real rename.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
