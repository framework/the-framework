The uniform behaviour of every dashboard control that changes something — push, open PR, stop, remove, save. While the action is in flight the control reports itself as busy and any error left over from a previous attempt is cleared; when it settles, busy always lifts, whether it worked or not.

Failure arrives in two shapes and is presented as one: the daemon answering that the action did not succeed and saying why, or the call failing outright. Either way the user sees a single error message — the reason given, or a wording the control chose for itself when the failure carries none — and the error stays until the next attempt or until the control dismisses it. The caller can tell success from failure, so a panel only runs its success behaviour (closing a dialog, navigating away, refreshing a list) when the action really succeeded.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
