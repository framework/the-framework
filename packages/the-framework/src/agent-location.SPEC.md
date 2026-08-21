Where an agent's turns execute — this device, a fresh CI runner, or a cloud session — as its own axis, separate from which coding-agent CLI drives them.

## Flows

- Whether an agent hands the task somewhere this machine cannot follow is a fact about the location, not about the agent. Only a cloud session does: it opens its own pull request and never reports back, so the first prompt is the whole agent. Every later phase would misread the driver's hand-off note as the agent's own reply — and would show the user questions nobody here can answer, asked on behalf of an agent that is somewhere else. A CI runner streams its agent's replies and is followed like a local agent.

## Rationales

- *Which driver* and *where it runs* are two orthogonal questions with two seams: folded into one dimension, the same driver appears as three implementations depending on where it happens to run.
- This axis carries no server-only code, because the dashboard, the registry and the store all name it and none of them should have to reach the driver layer to do it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
