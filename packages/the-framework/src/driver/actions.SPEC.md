A driver that runs the agent on GitHub Actions instead of the user's machine: dispatch a workflow, wait for it, read back the transcript the agent uploads.

## User Stories

- The user sends an agent to a fresh GitHub Actions runner instead of their machine and still reads the same transcript on the dashboard.
- The user's own Claude subscription pays for the runs: the repo holds a token the user minted, never an API key of the product's.

## Flows

- The same driver contract at a different tempo: every prompt is a fresh runner, turns take minutes, and the agent's progress replays in one burst at the end instead of trickling live.
- Continuity across turns is the branch the previous turn pushed plus the carried session id: the next turn starts from that branch, so a multi-pass agent keeps building on its own work. The code the agent produced is read off that branch too, because the runner is gone by the time anyone asks.
- The token that dispatches a run must belong to a real user — a bot-triggered agent is refused.
- Each dispatch carries a unique correlation tag, so a restarted framework can never mistake a stale or foreign run for its own.
- Nothing the user typed can reach the runner's shell as syntax: the prompt travels as workflow input data, and the two values that do land in that shell — the model name and the resume session id — are refused unless they are plain ids.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
