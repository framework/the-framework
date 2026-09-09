What the tests cover, against a real git repository:

- **Who a claim names** - `AGENT_ID` from the environment wins over the branch; a blank value counts as unset; without it the current branch is the holder; a detached checkout with no `AGENT_ID` yields no identity, while one with `AGENT_ID` still names the agent.
