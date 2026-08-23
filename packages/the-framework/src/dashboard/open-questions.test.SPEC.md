What the tests cover: a parked agent yields one open question carrying the whole gate — every option and the recommended one — read from the agent's own worktree rather than the project root, and labelled with the agent's session name, its task and when it last spoke; a gate that has been answered counts as closed, and the same gate asked again counts as open once more; agents that are not running, are running without a pending gate, or whose log shows the gate already answered contribute nothing; questions come back longest-waiting first; a project or event log that cannot be read contributes nothing instead of failing the whole list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
