Covers the turn-signal parsing: the one ask-gate block with its tolerant defaults and latest-block-wins (falling back past a malformed block, and refusing a block with nothing pickable in it), the several-picks and plan-file gate variants, an option marked as ending the agent, markdown views, session-name slugging (a session legitimately named "view" is kept), ready-for-merge detection, the pull request an agent writes for the framework to publish (its first line taken as the title and the rest as the body, a one-line block taken as a title alone, a first line too long to be a name for the work taken as body text instead, markdown kept whole, the last block winning, an empty one ignored), and the single continuation wording shared by every path.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
