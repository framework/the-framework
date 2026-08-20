Automatically reclaims an agent's checkout once its work is on the remote — the branch, the commits, and the agent's history are kept, so only disk is freed.

## Flows

- One rule decides every removal, shared with the dashboard's manual Remove button so the automatic path and the manual one cannot disagree: the work is committed to the agent's branch, the branch is pushed, and the checkout goes only once the remote has it. Every deletion is therefore recoverable, because the remote holds a copy.
- The sweep is what reaches the agents the teardown could not: a push that failed then (offline, no auth, a rejected non-fast-forward) simply succeeds on a later pass. There is one failure mode, and it is said out loud — once per kept checkout per reason, not once per pass: a checkout that can never be reclaimed would otherwise repeat the same line every ten minutes for as long as the daemon runs, while a reason that changes is a changed state and is said again.
- Whether the repo has a remote at all is asked once per project: with none, every checkout is kept and accounted for without probing each one for a push that cannot land.
- A live agent keeps its checkout: its driver is working in there, and Stop is how one ends. So does one the daemon has not finished retiring — an agent's records say `done` a beat before its teardown reclaims the checkout, and "not live" is not "nobody is holding this".
- Every project is swept once at startup and every ten minutes after, on the daemon's shared clock rather than a timer of its own, and each removal is announced so it never reads as a bug.

## Rationales

- The one rule asks *is the work safe yet* rather than *how did this agent end*: one predicate, checkable at any moment, with one failure mode — where per-ending rules (a clean finish removes the checkout, a failure or stop keeps it, a merged branch reclaims it later through separate "landed" signals) leave the kept checkouts accumulating, one per failed agent, forever.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
