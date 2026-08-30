The market-research preset: the agent researches the market the project competes in thoroughly, writes the result to `knowledge-base/MARKET_RESEARCH.md`, and puts one entry on the agent queue (`TODO_AGENTS.md`), with the `tickets` skill's command, naming this session and asking for new tickets to be suggested from it.

## Business logic — TL;DR

- **Research now, tickets later** - the research lands as a committed file, and turning it into tickets is queued as separate work rather than done in the same agent.

## Business logic

### Research now, tickets later

#### User story

The user wants to know what the market looks like, and then wants that knowledge turned into things to work on — but as two reviewable steps, not one agent that researches and fills the roadmap in the same breath.

#### Business logic

The research lands as a committed file, which is what puts it in every later agent's starting context. The queued follow-up entry is what turns it into tickets: a separate agent reads this session's research and proposes tickets from it. The preset names the session itself rather than being handed one, because it is started from the launcher where no session exists yet.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
