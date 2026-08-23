The maintenance sweep: a background job that walks the registered projects and puts an agent on the code that has changed since the last time it was reviewed, plus the pacing of the periodic codebase-wide pass.

## Business logic — TL;DR

- **Only new work is reviewed** - each project records the commit it was last reviewed at, so a sweep acts on the commits grown since then and never re-reads what it already reviewed.
- **A first-seen project is baselined, not back-reviewed** - the project's current commit is simply recorded, so its entire pre-existing history is never dragged through a review.
- **A review only counts when it succeeds** - the reviewed commit is recorded only after the agent finished successfully, so a failed review is picked up again by the next sweep.
- **A rewritten history re-reviews** - when the recorded commit no longer exists, the project is reviewed again rather than assumed clean.
- **A sweep can be capped** - it stops after a set number of reviews; the projects it did not reach are reported as still pending, and baselines and skips do not count against the cap.
- **The codebase-wide pass is paced separately** - a whole-codebase pass is due for a project it has never had, or that last had one longer than a week ago; this schedule and the commit-by-commit review position are kept apart so neither can reset the other.

## Business logic

### Reviewing what grew since last time

#### User story

The user wants their registered projects to be quietly kept in good shape without paying for the same review twice, and without a quality pass over history they never asked anyone to read.

#### Business logic

For each registered project the sweep resolves the current commit and compares it against what the project records as last reviewed:

- Never reviewed: the project is **baselined** — the current commit is recorded, and nothing is reviewed. This deliberately writes off all pre-existing history.
- Unchanged since the last review: the project is **skipped**.
- New commits: the project is **reviewed**, and the number of new commits is what the agent is put on.
- Not a git repository, or a repository with no commits at all: an **error**, which is reported and skipped; it never stops the sweep.
- The recorded commit is unknown to git, because history was rewritten: the project is reviewed again, noting why.

Each project's review state — the commit last reviewed and when — lives in a small local file under `.the-framework/`, kept out of git. A missing, unreadable or malformed state file simply reads as "never reviewed", which baselines the project rather than failing it.

### Running the sweep

#### User story

The user wants the sweep to make progress across many projects without spending unbounded amounts in one go, and to see what it did.

#### Business logic

The sweep works through the assessed projects: baselining records the current commit and runs nothing; up-to-date projects are passed over; the rest get an agent, announced with how many new commits it is reviewing. Only a successful agent causes the reviewed commit to be recorded — a failure is reported as one and left for the next sweep to try again.

A sweep can be limited to a number of reviews; once that limit is reached the remaining projects are counted as pending and left for later. Baselines and skips never consume that limit, since they cost nothing. The sweep reports a tally: how many projects were reviewed, baselined, skipped, failed, and left pending. What bounds the spending of the agents themselves is the ordinary budget cap.

### The codebase-wide pass

#### User story

A project whose commits are all reviewed still deserves an occasional look at the whole codebase — especially a project that was baselined, whose entire history was written off the first time it was seen.

#### Business logic

A project is due a codebase-wide pass when it has never had one, or when its last one was a week or more ago. A never-swept project is due immediately, which is exactly the gap the commit-by-commit baseline leaves open. A recorded date that cannot be read counts as due, so a state file edited into nonsense gets the project swept rather than dropping it out of the schedule forever.

The date of the codebase-wide pass and the commit-by-commit review position are recorded independently, and writing one leaves the other untouched.

#### Rationale

The week is deliberately not a setting: a setting has to earn itself, and this one would not. The pass only queues follow-up entries, and only runs on an idle machine within its quota boundary, so the cost of it being slightly too eager is one backlog entry rather than a bill.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
