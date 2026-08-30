The claim on a ticket: a ticket is planned or worked by one holder at a time, and the claim is a file beside the ticket — `tickets/<STEM>.lock.md`, holding one line, `CLAIMED: <holder>` — on the branch where every reader already looks.

## User story

- Two agents are looking for work at the same time and must not end up on the same ticket.
- A caller starts a batch of agents on the tickets it wants planned, and each gets a ticket of its own.
- A caller learns that an agent it started ended with nothing, and frees the ticket it had claimed for it.

## Glossary

- **holder** - who a claim names: the agent, cloud session or person planning or working the ticket. Where the holder's name comes from is `holder`'s business.

## Business logic — TL;DR

- **The claim is a file, not a memory** - the holder may be on another machine, or a session whose local process is gone, so the guard is a committed file.
- **The claim lifts only deliberately** - there is no timed release.
- **An existing claim outranks the batch** - one lock per claim, and re-running the batch re-judges it instead of double-claiming.
- **Planning skips a planned ticket, implementing does not** - which side of a ticket's life the batch claims for decides whether an existing plan is in the way.
- **A batch that could not land says so** - nothing claimed and the reason logged; a batch that committed but could not push is kept, and the gap is logged.
- **A release frees a claim, or says whose it is** - freed for the holder that asked, refused when the lock names someone else, and reported as no claim at all when there is none.

## Business logic

### The claim is a file, not a memory

#### User story

See `## User story`.

#### Business logic

A ticket's claim is `tickets/<STEM>.lock.md`, holding the single line `CLAIMED: <holder>`. It is committed to the branch and pushed, so every reader — this machine's caller, another machine's, an agent's command in a fresh clone — sees the same claim. Reading a lock gives its holder; content that is not a claim line names nobody, and a lock that names nobody still locks the ticket (`tickets`).

#### Rationale

The guard cannot be anyone's memory: the holder may be on another machine, or a cloud session whose local process is gone.

### The claim lifts only deliberately

#### Business logic

There is no timed release. A claim lifts when the ticket is closed with its siblings, when its holder releases it, when a person releases it by hand, or when a caller frees a claim it made for a holder it knows ended with nothing.

#### Rationale

A holder can legitimately keep a ticket for days, and a lock lifted under a live holder re-opens the exact double-work window the claim exists to close.

### An existing claim outranks the batch

#### Business logic

A batch of claims is applied one ticket at a time: a ticket with no lock gets one naming the batch's holder for it; a ticket that already has a lock is left as it is and does not count as claimed — unless the existing lock names this very holder, which is the batch's own claim seen again and still counts as locked. The batch resolves the subset actually locked, and lands as one commit naming the ticket when there is one and the count when there are several.

#### Rationale

Applying the claims is a function of the folder it is handed, so it is safely re-runnable: when a push loses a race the writer re-applies the same intent against the fresher state, and the re-run re-judges every ticket rather than claiming twice or reporting a ticket someone else won in the meantime.

### Planning skips a planned ticket, implementing does not

#### Business logic

A batch claims for one of two sides of a ticket's life. A batch that is about to *write* plans skips a ticket that already has a `.plan.md`: the work it came for is already done. A batch that is about to *implement* a plan does not — the `.plan.md` is its input, not a competing claim — so only an existing lock stands in its way.

### A batch that could not land says so

#### Business logic

A claim goes through the caller's write cycle (`store`), and never throws. A batch whose cycle could not land at all claims nothing and logs why — otherwise "no claims" would be indistinguishable from "lost every race". A batch that committed but could not *push* is kept and reported as claimed: the commit already guards every reader of this machine's checkout, and the gap the other machines have is logged rather than treated as a failure.

### A release frees a claim, or says whose it is

#### Business logic

Releasing one ticket has three outcomes: the claim was freed, there was no claim to free, or the claim is someone else's. A release made on behalf of a named holder frees the lock only while it still names that holder — a lock naming anyone else is someone's live claim and outranks the release; a release with no holder named frees whoever holds it. A release that cannot land changes nothing and reports the error: the write cycle restores the checkout, so the committed state keeps telling the truth about the claim.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
