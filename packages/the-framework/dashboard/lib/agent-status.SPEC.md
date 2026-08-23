The one status word an agent is shown as — failed, stopped, publishing, ready for merge, building or finished — derived from its event log, so every surface that shows an agent says the same thing about it.

## Business logic — TL;DR

- **One agent, one word** - the statuses are exclusive and ranked, because an agent can hold several of the underlying facts at once (signal ready for merge and then be stopped, or fail after signalling it).
- **How the agent ended outranks anything it said on the way** - failed (with the failure's detail when there is one) and stopped come first; otherwise a green "ready for merge" would be a lie about an agent that then failed or was killed.
- **Publishing is an ending too** - an agent that ended cleanly with its handoff armed but not yet reported reads "publishing…", because pushing the branch, opening the pull request and merging it are what is actually happening in that window; it therefore outranks "ready for merge".
- **"building…" only while the agent is live** - the pulsing word settles as soon as the agent's run ends; an agent that ended without signalling ready for merge reads "finished".
- **Silence until there is something to say** - an agent that has not named its session, not signalled ready for merge and not ended gets no status word at all.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
