A driver that runs the agent on GitHub Actions instead of this machine: dispatch a workflow, wait for it, read back the transcript the agent uploads.

## Flows

- Same contract, different tempo: every prompt is a fresh runner, turns take minutes, and progress replays in one burst at the end instead of trickling live.
- Continuity across turns is the branch the previous turn pushed — the next one starts from it — plus the carried session id, so a multi-pass agent keeps building on its own work; produced code is read off that branch, because the runner is gone by the time we ask.
- Auth is the same bring-your-own-subscription posture as everywhere else: a token held by the repo, belonging to a real user — bot-triggered agents are refused.
- Each dispatch carries a unique correlation tag so a restarted framework can never mistake a stale or foreign run for its own, and every value forwarded to the runner is checked so nothing can act as shell syntax.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
