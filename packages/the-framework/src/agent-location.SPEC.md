Where an agent's turns execute — this device, a fresh CI runner, or a cloud session — as its own axis, separate from which coding-agent CLI drives them.

## TLDR

- Two orthogonal questions, two seams: *which driver* is that axis's, *where it runs* is this one's. They used to be one dimension, with the same driver appearing as three implementations depending on where it happened to run.
- Whether an agent hands the task somewhere this machine cannot follow is a fact about the location, not about the agent. Only a cloud session does: it opens its own pull request and never reports back, so the first prompt is the whole agent and every later phase would misread the hand-off note as the agent's own reply. A CI runner streams its agent's replies and is followed like a local agent.
- Node-free, because the dashboard, the registry and the store all name this axis and none of them should have to reach the driver layer to do it.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
