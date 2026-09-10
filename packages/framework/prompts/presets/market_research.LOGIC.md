The "Market research" preset of the launcher: the agent [1] researches the market the project competes in, writes the result to `knowledge-base/MARKET_RESEARCH.md`, and puts one entry on the agent queue [2] asking a later agent to read that research and suggest new tickets. It takes no parameter. The prompt defines its own "SESSION_NAME", the name of the session, rather than reading it from the template context, because it is launched from the launcher, where no agent exists yet to have a name.

## Context

**User story**: the user clicks "Market research" in a project's launcher; the project gains a committed market study every agent reads at its start (it is one of the context documents listed ahead of the built-in system prompt, described as "the market the project competes in"), and the agent queue gains the follow-up that turns the study into ticket proposals.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **Research the market thoroughly** - the agent makes a thorough market research.
- **Write it to the knowledge base** - the research is written to `knowledge-base/MARKET_RESEARCH.md`.
- **Queue the follow-up** - with `queue add` from the `queue` skill [3], the agent adds the entry "Read <SESSION_NAME> then suggest new tickets" to the agent queue, so the tickets are proposed by a later agent rather than by this one.
