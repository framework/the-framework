What the tests cover: everything the user does *to* a live agent — answer its question, chat with it, change its handoff, stop it, delete it — and the observable answer coming back through the agent's own event log.

**Answering a gate**

- A parked agent's gate reaches the live feed complete with its title, its options and its recommended option, and the cross-project open-questions list shows it against that agent and project with the same options.
- Picking an option records which option was picked and who picked it, and the agent carries on to finish.
- Once answered, the gate is gone from the open-questions list.

**Live chat**

- A message sent while the agent is parked is held until the gate is answered, then becomes the agent's next turn, with the user's text appearing as the prompt on the feed the transcript renders.
- What was said survives the agent: the archived event log carries the message, so a clone of the repo carries the exchange rather than only the fact that an agent ran.

**Changing the handoff mid-flight**

- The handoff starts armed at the default level. Lowering it while the agent runs re-announces the new arming on the feed, and that arming reaches the agent's record, so a tab opened later reads the current state rather than the initial one.

**Stopping and deleting**

- Stopping a parked agent ends it as stopped rather than failed: the user interrupted it.
- A stopped agent's checkout is reclaimed once its work is on the remote — the same single rule as for any other agent, regardless of how it ended — and the agent's row survives in the history. What was stopped is not lost, because its branch is on the remote.
- Deleting an agent is the destructive counterpart: its row disappears from the dashboard altogether.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
