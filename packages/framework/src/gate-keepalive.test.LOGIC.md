What the tests cover:

- **Holding and releasing** - the first pending hold starts the timer and settling it stops the timer, with the held value returned; a hold that fails releases the timer and rethrows its failure.
- **Sharing one timer** - overlapping holds share a single timer and the last to settle releases it; once everything has settled, a new hold starts a fresh timer.
- **The timer really holds the process** - the real idle timer is one Node counts as keeping the event loop alive, which is the whole point of the keepalive.
