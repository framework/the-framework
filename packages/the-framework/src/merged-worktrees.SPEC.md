Automatically reclaims a session's checkout once its work is on the remote — the branch, the commits, and the session's history are kept, so only disk is freed.

## TLDR

- One rule decides every removal, and it lives in the shared operation rather than here: the work is committed to the session's branch, the branch is pushed, and the checkout goes only once the remote has it. Every deletion is therefore recoverable, because the remote holds a copy.
- Three interacting rules used to decide this instead — a clean finish removes the checkout, a failure or stop keeps it, a merged branch reclaims it later through two different "landed" signals — each asking *how did this session end* rather than *is the work safe yet*.
- The sweep is what reaches the sessions the teardown could not: a push that failed then (offline, no auth, a rejected non-fast-forward) simply succeeds on a later pass. There is one failure mode, and it is said out loud.
- A live session keeps its checkout: its agent is working in there, and Stop is how a run ends.
- Every project is swept every ten minutes and once at startup, and each removal is announced so it never reads as a bug.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
