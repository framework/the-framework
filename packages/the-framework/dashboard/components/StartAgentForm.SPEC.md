The launcher form that starts an agent in the selected project: the shared composer plus the actual submit, the Context selector, and the system-prompt preview.

## Flows

- A typed prompt starts an attended conversation. A preset starts unattended routine work: it ends on its own once the agent's work settles, firing the hand-off it was armed with — how far the work publishes, up to push, PR, or merge.
- The options sent and the prompt previewed come from the same mapping the agent uses, so the form cannot disagree with the agent it starts; a picked device relays the start to that machine, the device's secret token riding in memory only — never persisted.
- Preflight warnings spend words before the agent is spent, and never block. They cover: a driver CLI that cannot start — the GitHub CLI checked only when a PR or merge is armed, and nothing probed for Actions or device targets; a repo whose disabled GitHub auto-merge means an armed merge is handled by the daemon's own merge-on-green, which works only while the daemon runs; and Haiku's known skipping of the finish step, which leaves a publishing run an unmerged draft PR.
- A start answers immediately: an optimistic row for the run appears in the sidebar and the view jumps to the agent before its record exists.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
