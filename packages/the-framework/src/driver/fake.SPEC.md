The fake driver: a driver that answers from a script instead of from a coding-agent CLI, so the whole product can run offline — no CLI installed, no model called, no cost, and the same outcome every time.

## User story

Someone wants to try The Framework, or to test it, without a coding-agent subscription. The dashboard, the agents, the gates, and the event streams all behave as they normally do; only the agent's answers are canned.

## Business logic — TL;DR

- **Turns come from a script** - an agent replays a prepared list of answers, one per prompt, in order. Answers can also be produced from the prompt itself when a scenario needs to react to what was asked.
- **A short script never starves a long agent** - once the script runs out, its last answer repeats, so an agent that takes more turns than the script anticipated still finishes.
- **The event stream is indistinguishable from a real one** - the same start, tool-call, text, and result events reach the dashboard, including any usage figures the script names, so every surface can be exercised end to end.
- **Files can be pre-seeded** - an agent can be given the file contents it will be asked to read, so flows that depend on reading what the agent wrote work with no agent at all.
- **Stopping still works** - an agent already stopped refuses further prompts, exactly as a real one does.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
