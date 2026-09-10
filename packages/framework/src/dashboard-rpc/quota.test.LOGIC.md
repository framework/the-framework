What the tests cover, for the usage panel's "Run now":

- **The sweep is waited for, not fired and forgotten** - the request returns only once the sweep [1] has actually run, and answers with the lines that sweep decided, one per project [2], so the panel can show the outcome instead of flashing and saying nothing.
- **The decisions survive the wait** - the lines the answer carries are the ones the sweep just decided, even when what the daemon exposes changes while the sweep is in flight.
- **A failed sweep and an unreadable report are different answers** - a sweep that fails outright is answered as a failure; a sweep that ran but whose decisions cannot be read back is answered as a success with no lines, so the panel can say the sweep ran rather than pretend nothing happened.
- **The narrowing reaches the sweep unchanged** - draining [3], planning, a single routine [4] named by the routine lock [5] it takes, a scope of one project [2], and no narrowing at all are each passed through exactly as asked for.

## Glossary

[1] sweep: a background job the daemon runs on its clock; here, Auto PM's — drain the agent queue, and refill it by running the routines.
[2] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[3] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[4] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance.
[5] routine lock: a file on the `agent-data` branch a daemon takes before running a routine so the routine runs once across machines.
