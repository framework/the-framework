The idle sweep ("auto PM"): when nobody is at the keyboard, decide whether to start unattended work, and pick what — drain the queue if it has entries, refill it if it is empty.

## TLDR

- `autoPmDecision` is a **pure policy function**; the daemon only supplies readings. Checks run cheapest-first: feature on? → concurrency cap? → per-project cooldown? → queue readable? → quota headroom?
- A non-empty queue **drains** (one pinned entry per run, so parallel drains work on disjoint entries); an empty queue **refills** by rotating through the routine jobs (update-tickets → triage-quick → triage-consensual → spike-and-plan). The calendar-paced maintenance sweep sits outside the rotation and takes precedence when due.

## Decisions

- Every refusal is phrased as a *reason*, named precisely enough that a setting does not read as a bug (the quota refusal names the actual boundary including the user's slider offset).
- An unreadable queue fails **closed**: it is neither empty nor full, and since both answers now start work, only "we could not tell" starts nothing.
- Draining exists because the backlog loop only runs inside a session a human started — without it, an unattended queue filled once and never emptied.
- Job capabilities (`drains`, `fansOut`, `pinnedBranch`, `autoMerge`) are **data on the job**, never name-matched at the call site. Only the drain job sets `autoMerge`: its work was already triaged as consensual quick wins a human could have vetoed on the queue.

## Facts

- Spike-and-plan is the one rotation job that fans out to several agents (one ticket each) — it writes per-ticket sibling files rather than rewriting the shared queue document.
- Triage jobs pin their session name, so their branch must be released (see `stale-branch.ts`) before firing or the routine jams forever.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
