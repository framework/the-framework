What the tests cover: the framework's run in the `logs` skill's two shapes, both ways.

- **The card** - the framework's agent meta becomes a card with the skill's eleven fields on top and every other field under `caller`; a meta with none of those gets no `caller` key at all; the card unfolds back into the same meta, and a card without a last-updated time gets one from its end or its start.
- **The diary** - what the agent said, its result, the run's cost and its ending become the skill's four kinds of line, their extra fields carried along; every other event is written as it is; the diary reads back as the same events, an ending's `done`, `stopped` and `failed` included.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
