What the tests cover: everything the user sees between clicking Start and reading the finished agent's row in the history — driven through the same requests the dashboard makes, with real spawned agent processes and the fake driver doing the work.

**Starting an agent and watching it live**

- The live feed narrates the agent the way the dashboard renders it: the session banner naming the driver, then the agent's turn, its usage accounting, and finally the ending — in that order.
- The agent process is started with exactly the handoff level the launcher asked for and with the agent id whose worktree it was given.
- The finished row carries what the history list shows: the prompt as its label, the branch the work is on, and the driver that ran it.
- The archived history replays the same story the live feed told, and the cross-project activity feed and recent-agents list both show the finished agent. The activity feed also states which projects it managed to read whole, so a reader can tell "nothing happened" from "could not reach it".

**Publishing nothing**

- An agent set to publish nothing keeps its checkout: it stays on the Remove list, its branch never reaches the remote, and the agent still addresses its own checkout.
- Because the agent's own record is committed onto its branch at teardown, the handoff panel reports that branch as existing but carrying nothing publishable.

**Two agents at once**

- Two agents started back to back get different ids and run at the same time, each parked on its own question — neither blocks the other, and neither works in the user's own checkout.
- Both show as running, each names its own separate checkout, and the daemon reports one active slot per agent naming the agent and its process.
- Answering each agent's question lets each finish independently, and the daemon eventually reports no active slots once it has reaped both.

**Publishing a finished agent**

- Pushing a finished agent's branch from the handoff panel succeeds even when fired the instant the agent finishes, while the daemon is still tearing it down: the push and the teardown do not collide, the branch reaches the remote, and the checkout is still retired rather than stranded.
- The handoff panel then reports the branch, that it exists, that the project has a remote, and that the branch is pushed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
