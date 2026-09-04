What the tests cover: the background services end to end against a real registry and a real project checkout, with only the agent spawn itself stubbed.

The concurrency setting the user saves is the number of agents the draining routine actually spins up — not the shipped default and not the queue's length — and each of those agents is pinned to a different open queue entry, in queue order, carrying that entry's ticket so the agents work in separate lanes. Every such agent is started unattended, is armed to land its own pull request, and is not marked as a planning agent. Before each agent starts, the daemon commits the ticket's claim onto the `agent-data` branch under the id of the agent it then starts, so the claim names the run that holds it; the ids of one batch are minted distinct from each other. The report the dashboard reads says the whole batch went out, not just its first agent.

The draining routine's "Run now" button fans out to the same concurrency setting even while the Auto PM preference is off — the scheduled sweep stands down on its own, and the click is what asks.

Retiring a drained queue entry: once the agent's record says it finished and its handoff published the work, the daemon — the queue's only local writer — deletes that entry as a commit on the `agent-data` branch, leaving every other entry exactly as written; the agent never touches the queue itself. An agent whose handoff failed leaves its entry open, so unpublished work is not retired.

A queue entry whose ticket file no longer exists is still claimed and started, recreating the tickets directory on the way, instead of standing the batch down as already claimed.

Data sync: a project that cannot reach a remote carries a data-sync error naming the reason, and the daemon's log says so too; the first sync that converges clears the error rather than re-wording it.

The quota gate is measured against the model the agent would run on: a model whose own quota week is spent starts nothing, however much of the account's overall week is left, and the stand-down names the exhausted window rather than saying "quota". The same spent model does not stop work configured to run on a different model that still has allowance.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
