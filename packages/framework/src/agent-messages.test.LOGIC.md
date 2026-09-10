What the tests cover:

- **Delivery order** - messages already queued come out first in, first out between turns; a message pushed while the agent is parked waiting is handed to that wait at once.
- **What ends a wait** - closing the queue wakes a parked wait with nothing; a wait on an already closed queue resolves with nothing at once; the agent's stop signal unblocks a parked wait with nothing; a message already queued is still handed out when the stop signal has already fired, so it is not lost.
- **After a close** - a message pushed after the close is dropped.
- **Taking only what has already arrived** - the end-of-work check hands out a queued message without waiting and reports the queue idle at once when nothing is queued, which is what lets the agent end itself; once the queue is closed it reports idle even with a message still queued, so a stale message never starts a new turn on a stopped agent.
