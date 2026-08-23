The `.lock.md` claim on a ticket: assigning a ticket to a single agent by writing a lock file beside it on the data branch, so concurrent agents — a planning fan-out on this machine, a drain, an agent on another machine, a hands-off cloud session — never double-work the same ticket.

## User story

- Auto PM fans out several planning agents at once; each must plan a different ticket.
- A drain agent starts implementing a planned ticket; no other agent may pick the same ticket up meanwhile.
- An agent dies or ends with nothing to show; the user (or, for one specific case, the daemon itself) frees its claim so the ticket becomes workable again.

## Glossary

- **lock** — a ticket's `tickets/<STEM>.lock.md` sibling whose first line is `CLAIMED: <agent id>`, the claim file the Ticketing format defines.
- **plan** — a ticket's `tickets/<STEM>.plan.md` sibling holding its implementation plan, written by Auto PM's planning routine.
- **write funnel** — the data branch's single write cycle (sync, apply the change, commit, push), which re-runs the change against origin's fresher state when a push loses a race and restores the checkout when a cycle fails whole.

## Business logic — TL;DR

- **The claim is a file, not the daemon's memory** - the lock lives with the ticket on the data branch, where every agent already looks, so agents that have never heard of this machinery (stock prompts, other machines, hands-off sessions) still skip a locked ticket.
- **A batch claims through the write funnel, and an existing file outranks it** - one lock per assigned ticket, committed and pushed as one batch; a ticket whose lock (or, for a planning batch, whose plan) already exists is skipped, not overwritten — unless the lock names this very agent, which is the batch's own claim seen again on a re-run.
- **Plan and drain batches judge a plan differently** - a planning batch is about to write plans, so an existing plan means its work is already done; a drain batch is about to implement a plan, so the plan is its input and only an existing lock stands in the way.
- **A commit that could not push still counts** - it guards every agent forked from this machine (the common case); the cross-machine gap is logged, not treated as failure. A cycle that could not commit at all claimed nothing, and says so.
- **No timed release** - a lock lifts only when the ticket's work lands and the tickets sync retires the files, when a human releases it from the dashboard, or when the daemon frees the one claim it minted for an agent that settled with nothing to hand off.

## Business logic

### The claim is a file on the data branch

#### User story

See `## User story`: agents on other machines and hands-off cloud sessions must respect a claim this daemon made, and vice versa.

#### Business logic

A ticket's lock is its `.lock.md` sibling (e.g. `2026-07-31_some-ticket.md` → `2026-07-31_some-ticket.lock.md`) holding a single claim line, `CLAIMED: <agent id>`. Content that does not start with the claim line names no holder. Because the Ticketing format itself defines this file, the stock prompts already tell every agent to skip a locked ticket — no cooperation from anything that has not heard of this module. Locks are written on the data branch through the write funnel like every other data write, which is what carries a claim to every machine; the lock and release commits name what happened (how many tickets were locked, which ticket was released, and — for an abandoned claim — that its agent ended with nothing to hand off), so the branch history reads as what happened.

#### Rationale

The guard cannot be the daemon's memory: a hands-off agent's local process ends at the hand-off, and another machine's daemon never shared this one's memory at all. A file where every agent already looks is the only seam all of them share.

### Acquiring a batch of claims

#### User story

Auto PM assigns a set of tickets to a set of agents in one sweep pass and needs to know which claims actually stood, racing other machines doing the same.

#### Business logic

A batch writes one lock per assigned ticket inside one funneled cycle and resolves with the subset actually locked. Per ticket: an existing lock outranks the batch and the ticket is skipped — except a lock naming this very agent, which is the batch's own claim seen again when the funnel re-runs the cycle after losing a push race, and still counts as locked. A planning batch also skips a ticket that already has a plan (the work it came for is done); a drain batch claims a planned ticket, since the plan is its input. The judgment is redone from scratch on every re-run of the cycle, against whatever state the re-sync brought in, so a re-run can never double-claim or double-count. The lock's parent directory is created when missing — retiring the last ticket removes `tickets/` entirely, and the branch is born without it.

A cycle that could not commit at all resolves with nothing claimed, and logs the error even for an empty batch — otherwise "no claims" is indistinguishable from "lost every race", and the sweep's real stand-down reason is invisible. A cycle that committed but could not push resolves as locked anyway: the commit still guards every agent forked from this machine, and standing a healthy local fan-out down over a network blip costs more than the cross-machine window it briefly leaves open — a window the log names. Nothing here ever throws; it runs on a background tick with nothing to catch it.

### Releasing a claim

#### User story

A dead agent's lock would otherwise hold its ticket forever; the dashboard's release button is the user's tool, and the daemon cleans up the one case it can prove.

#### Business logic

A release removes the ticket's lock in one funneled cycle and reports what it did: released, no lock to free, someone else holds it, or the cycle could not land. The plain release (the dashboard button) frees whoever holds the lock. The held-by release is the daemon freeing a claim it minted for an agent that settled with nothing to hand off: it frees the lock only while it still names that exact agent — a lock naming anyone else is someone's live claim (released by hand and re-claimed, say) and outranks the cleanup. A cycle that could not land reports an error and changes nothing: the funnel restores the checkout, so the committed state keeps telling the truth about who holds the ticket. A release that committed but could not push stands, with the gap logged.

#### Rationale

There is deliberately no staleness timer: a coordinator agent can legitimately hold a ticket for days, and a lock auto-released under a live agent re-opens the exact double-work window the lock exists to close. Every dead agent beyond the daemon's one provable case is the user's to notice, with the dashboard button as the tool.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
