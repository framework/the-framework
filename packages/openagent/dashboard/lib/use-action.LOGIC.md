Gives every action the user triggers in the dashboard the same behavior: while it runs the control that started it reports itself as busy, when it fails the reason is shown on that same control, and only when it succeeds does the surface do its success side.

## Business logic — TL;DR

- **In flight** - starting an action marks it busy and clears whatever reason the previous attempt reported, so a stale message never sits under a fresh attempt. Busy ends when the action answers, whether it succeeded or failed.
- **A refusal is a reason, not a crash** - an action the daemon refuses reports the daemon's own reason; the caller is told the action did not happen and skips its success side.
- **A failure that carries no reason** - an action that fails with nothing to say, such as the daemon not answering, reports the wording the calling surface supplies, which defaults to "Something went wrong."
- **An action that answers nothing is a success** - an action with no result to report is not mistaken for a failure.
- **The reason can be dismissed** - the surface can clear the reported reason, for instance when the user edits the form and is about to try again.
