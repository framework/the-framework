What the tests cover: the two waits that keep the daemon from misjudging an agent that is between states.

Waiting out an agent's previous leg before continuing it: a checkout nothing holds is continued at once, without even asking how the previous leg ended; a leg that reports itself still running is a genuine collision, so the wait is skipped and the busy refusal stands; a leg that reports itself finished is waited out and the wait ends the moment its process exits; a retirement already in flight is awaited even after the process is gone, and a retirement that fails does not fail the continuation waiting on it; the wait is bounded, so a finished leg whose process never exits eventually falls through to the busy refusal rather than hanging. A leg whose status cannot be read at that instant is asked again instead of being taken for a live one — and it keeps being asked until it commits, at which point "still running" short-circuits to the refusal — while a leg that answered "finished" once is never re-read.

Stopping an agent that will not go: an agent that ignores the terminate signal is killed after the grace period together with the child it launched, so a browser standing in for the agent's Chrome is gone as well, not left behind on the init process.

Waiting out the agent slots shutdown just stopped: slots nothing holds return immediately; a slot whose process has gone but whose teardown has not started yet is still waited for, including the teardown that appears mid-wait; an agent that got no worktree parks no teardown and holds nothing up; a teardown that throws does not fail the shutdown waiting on it; and the wait is bounded, so a wedged teardown costs the grace period instead of hanging the shutdown.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
