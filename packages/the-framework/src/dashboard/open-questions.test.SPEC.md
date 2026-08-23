What the tests cover: a parked agent yields one open question carrying the whole gate — every option and the recommended one — read from the agent's own worktree rather than the project root, and labelled with the agent's session name, its task and when it last spoke; a gate that has been answered counts as closed, and the same gate asked again counts as open once more; agents that are not running, are running without a pending gate, or whose log shows the gate already answered contribute nothing; questions come back longest-waiting first; a project or event log that cannot be read contributes nothing instead of failing the whole list.

Also covered, for the questions the Claude web bridge carries home from a cloud session:

- A `web`-target agent's question arrives from the bridge rather than from any event log, is matched to that agent through the cloud session it handed its task to, and comes back as an ordinary open question whose options are answerable by label — carrying the question's multi-select flag, its checked-by-default option and its detail lines — with its wait counted from when the bridge saw it, not from the hand-off.
- The match is made against the project's whole record of agents, archived ones included, because a `web`-target agent is already finished; and it is read only when there is a bridged question to join, never otherwise.
- Two checkouts of one repository, which share that record, yield one card for the same cloud session rather than one each.
- A bridged question whose cloud session matches no agent here is not offered at all.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
