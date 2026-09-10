Claims a ticket for one holder [1] at a time and releases it again: the claim [2] is a file beside the ticket on the `agent-data` branch [3], `tickets/<stem>.lock.md`, holding the one line `CLAIMED: <holder>`, so two agents [4] never plan or work the same ticket, on this machine or on any other. Every claim and every release lands as one commit on the branch through the caller's write cycle (the rules in `store.ts`): a commit that could not be pushed still counts, and a write that could not commit claims or releases nothing.

## Context

**User story**: the daemon starts several agents [4] at once on tickets, a fan-out [5], one per ticket to plan or one per queue entry to work, and each agent may only work a ticket nobody else holds. An agent runs `npx tickets claim <file>` and is told whether the ticket is now its own or someone else's. When the plan or the work is done, the holder [1] releases the ticket, or closing the ticket lifts the claim [2] with it.

**Problem**: the holder may be on another machine, or in a cloud session [6] whose local process is gone, so the guard cannot be anyone's memory: it has to be a file where every reader already looks, on the `agent-data` branch [3].

## Glossary

[1] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[2] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] fan-out: starting several agents at once, one per queue entry or one per ticket to plan.
[6] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[7] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.

## Business logic — TL;DR

- **The claim is one line in a file beside the ticket** - `tickets/<stem>.lock.md` holds `CLAIMED: <holder>` and nothing else; a file whose first text is not such a line names no holder, yet still claims.
- **A claim never expires** - it lifts only when the ticket is closed, when its holder releases it, when a person removes it by hand, or when the daemon frees a claim it made for an agent it knows ended with nothing.
- **Claiming to plan or to implement** - a claim made to write a plan skips a ticket that already has one; a claim made to implement takes a planned ticket, and only someone else's claim stands in its way.
- **A batch re-judged, never double-claimed** - an existing claim naming the same holder counts as the batch's own claim; anyone else's, or one that does not parse, keeps the ticket out of the batch; re-applying the batch gives the same answer.
- **How claims land** - one commit for the whole batch; a batch that could not commit claims nothing and says why; a batch committed but not pushed keeps its claims and logs the gap.
- **Releasing a claim** - the claim is removed when it exists and, if the release names a holder, still names that holder; otherwise the release reports "no-lock" or "not-holder" and touches nothing.
- **How a release lands** - one commit; a release that could not commit reports an error and changes nothing; one committed but not pushed stands, the gap logged.

## Business logic

### The claim is one line in a file beside the ticket

#### Context

See `## Context`.

#### Business logic

A ticket's claim [2] is the file `tickets/<stem>.lock.md`, `<stem>` being the ticket's filename without `.md`, committed on the `agent-data` branch [3] so agents on other machines see it. It holds one line, `CLAIMED: <holder>`, and nothing else. Reading it back, leading blank lines and whitespace are skipped; the text must then start with `CLAIMED:`, and the holder [1] is the rest of that first line with surrounding whitespace removed, spaces inside the name kept. A file that starts with anything else, a bare `CLAIMED:` with no name, or an empty file names no holder. The file's existence, not its content, is what makes the ticket claimed; the holder it names decides only who may release or close the ticket.

### A claim never expires

#### Context

**Problem**: a holder can legitimately keep a ticket for days, and a claim lifted under a live holder reopens the exact double-work window the claim exists to close.

#### Business logic

There is no timed release. A claim [2] lifts only when the ticket is closed together with its plan and claim (the `close` command in `cli.ts`), when its holder [1] releases it, when a person removes the file by hand on the branch, or when the daemon frees a claim it made for an agent [4] it knows ended with nothing, naming that holder so it never frees anyone else's.

### Claiming to plan or to implement

#### Context

**Business logic story**: the daemon claims tickets in batches for the agents [4] it is about to start: a fan-out [5] to write plans, one agent per ticket to plan, or a drain [7], one agent per queue entry that links a ticket, to implement. The `tickets claim` command always claims to implement (the rules in `cli.ts`).

#### Business logic

A claim [2] says which side of the ticket's life it is for. A claim to plan is about to write the ticket's plan, so a ticket that already has a `.plan.md` is skipped with no claim written: the work the claim came for is already done. A claim to implement is about to work an existing plan, so the plan is its input and never in its way; only an existing claim stands in its way. In both cases a ticket someone else holds is skipped.

### A batch re-judged, never double-claimed

#### Context

**Problem**: a batch lands on the branch as one commit pushed to the remote, and a push can lose a race against another machine's push; the write cycle then re-applies the batch on the remote's fresher state, so applying the same batch twice must not read the batch's own first claim as someone else's.

#### Business logic

A batch is a list of tickets, each with its holder [1]. Applying it to the branch's checkout goes ticket by ticket. When the ticket already has a claim [2], the ticket stays in the batch only if that claim names this very holder, the batch's own claim seen again, and is dropped when the claim names anyone else or names nobody because its line does not parse. When the ticket has no claim, the batch is a claim to plan and the ticket has a plan, the ticket is dropped. Otherwise the claim is written and the ticket stays. The answer is the subset actually claimed; it depends only on the batch and the checkout, so re-applying the batch writes nothing new and gives the same answer. Claiming a ticket one already holds therefore succeeds and writes nothing.

### How claims land

#### Context

See `## Context`.

#### Business logic

The whole batch lands as one commit on the `agent-data` branch [3], pushed, named "claim tickets/<stem>" when one ticket was claimed and "claim <N> tickets" otherwise, N being the tickets actually claimed. When the commit could not be made at all, no ticket is claimed, the batch answers with nothing claimed, and the reason is logged ("[tickets] the claims could not be committed"): silence would make "nothing to claim" indistinguishable from "lost every race". When the commit was made but could not be pushed, the claims stand and are answered as claimed: the commit already guards every reader of this machine's checkout, and the gap toward other machines is logged ("[tickets] the claims could not be pushed, so other machines cannot see these N claim(s)") rather than treated as failure. Claiming never throws.

### Releasing a claim

#### Context

**User story**: a holder [1] is done with the plan or the work and lifts its claim [2] before stopping; the daemon frees the claim it made for an agent [4] that ended with nothing.

#### Business logic

A release names the ticket and, optionally, the holder [1] it expects. With no claim file, the release reports "no-lock" and changes nothing. With an expected holder, the claim [2] is removed only while it still names exactly that holder; a claim naming anyone else, or one whose line does not parse, is someone's live claim that outranks the release, which reports "not-holder" and changes nothing. Without an expected holder, whoever holds the claim is released. A removed claim is reported as "released".

### How a release lands

#### Context

See `## Context`.

#### Business logic

A release lands as one commit named "release tickets/<stem>", pushed; a release that found no claim, or someone else's, changes nothing and commits nothing. A release that could not commit reports an error and changes nothing: the write cycle restores the checkout, so the committed state keeps telling the truth about the claim [2]. A release committed but not pushed stands, and the gap is logged ("[tickets] the release of <file> could not be pushed").
