Adoption: the pass that matches a cloud session's actual `claude/*` branch back to the waiting `web`-target agent's record and records what it finds onto the agent's archive. A `web`-target agent is a local hand-off that ends once the task is handed to claude.ai; the cloud session then does the work on a branch of its own naming (`claude/*`), never the agent branch the agent was born on. Without this pass nothing ever tells the agent's record about that branch, so every surface keyed to it — the agent's row, PR resolution, CI watch, merge — stares at an empty `agent-*` branch while the work sits on origin.

## Glossary

- **hand-off anchor** — the empty commit, unique to one agent, that the driver pushes as the ref the cloud session clones at. The session's branch — and only it — descends from that commit, which is what makes the match exact rather than guessed.

## Business logic — TL;DR

- **Ancestry makes the match exact** - a `claude/*` head on origin belongs to the agent whose hand-off anchor it descends from; exactly one descendant adopts, zero or several adopt nothing and are retried next pass.
- **What is learned lands as one commit** - the branch (first time only) and the PR (once known) are recorded onto the agent's archive on the data branch; nothing learned, nothing written.
- **The armed draft PR finally opens** - an agent set to open a PR whose session pushed work but never opened one gets its draft PR opened by this pass.
- **"None" and "could not tell" never look alike** - a PR listing that fails records the branch but opens nothing this pass, so a transient failure can never produce a second PR on a branch that already has one.
- **Bounded and quiet** - only settled `web`-target agents started within the last 48 hours are asked about, the archive is read by that window so old history costs nothing, and only adoptions and failures are logged.

## Business logic

### Matching by hand-off-anchor ancestry

#### User story

A user hands a task to Claude web from the dashboard and walks away. Later, the agent's row shows the branch the cloud session actually worked on and the PR it opened — without the user reconciling branch names by hand.

#### Business logic

The pass owes an answer to agents that are: `web`-target, no longer running, carrying a hand-off anchor, and started within the 48-hour adoption window — and that are either still on the branch they were born on (no adoption yet), or already adopted but finished with the PR they were set to open still unaccounted for. An agent whose PR stage was turned off stops being asked about once its branch is recorded; a PR someone opens later is still found live, by branch name, by every surface that shows PRs.

With anything waiting, the pass brings origin's `claude/*` heads local in one fetch for the whole pass (pruned, so a branch deleted on origin stops matching; written as standing remote-tracking refs so later garbage collection cannot discard the objects), then asks which heads descend from each waiting agent's anchor. Exactly one match adopts. Zero — the session has not pushed, or never will — and two or more — ancestry alone cannot say which is the agent's — both adopt nothing and are the next pass's question. An agent whose record names some other branch, neither its birth branch nor the matched head, is left alone entirely: a PR opened here would be recorded against a branch it does not live on. An anchor whose commit is not local reads as no match, which is exactly the case where the session has pushed nothing for it to be an ancestor of.

### Recording the branch and resolving the PR

#### User story

The publish level the user armed the agent with must still come true when the session did the work but never opened the PR itself — and a hiccup reading GitHub must never double-open one.

#### Business logic

For the matched branch, the session's own PR is looked up from the branch's PR history, filtered by the agent's start time so a predecessor's PR on a reused branch name is never this agent's, latest one wins. When the listing succeeds and finds none, the agent finished, its handoff includes the PR stage, and the head carries commits beyond the anchor itself, the pass opens the draft PR the agent's own epilogue never could (it saw only the empty agent branch) — the armed handoff finally resolving against the facts. A head that *is* the anchor gets no PR: the session pushed nothing, and a PR over nothing helps nobody. A listing that fails is a reported failure, records the branch (a fact regardless), opens nothing this pass, and leaves the agent to be asked again — "the session opened no PR" and "the listing could not be read" must not look alike, because guessing cost a duplicate draft PR once.

Whatever the pass learned — the branch on first adoption, the PR once known — is recorded onto the agent's archive as one commit on the data branch. A record that cannot be written is a reported failure and is retried.

### The adoption pass as a daemon service

#### Business logic

One tick passes over every registered project. Adoptions and failures are said out loud — an agent's row changing branch with no log line explaining why would read as a bug — while unmatched agents are not: a session that has not pushed yet is the normal waiting state. Overlapping ticks join the pass already running, so awaiting a tick means the pass finished; the service keeps no timer of its own (the daemon's one clock ticks it); a stopped service ticks as a no-op; and a repo with no reachable remote adopts nothing and never throws.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
