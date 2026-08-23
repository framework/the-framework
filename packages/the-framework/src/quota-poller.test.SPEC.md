What the tests cover:

- **A blip never blanks the number** - after a failed reading the failure is reported as the latest attempt while the last successful reading, and the time it was taken, still stand; the time of the failure is recorded too and polling continues.
- **Backing off** - each consecutive failed reading doubles the wait before the next one, the wait stops growing at the half-hour ceiling no matter how many failures follow, and the first successful reading returns it to the healthy interval.
- **Giving up for good** - a failure meaning there is nothing to read at all — no subscription on the account, or no driver CLI installed — stops polling permanently and discards the retained reading, so a previously good number can never misrepresent such an account.
- **An unreadable answer is not a verdict** - a reading the framework could not make sense of leaves polling running and the retained reading intact, and a later readable answer restores both the number and the healthy interval. This pins a past defect where one unreadable first reading stopped polling for the daemon's entire life, so the usage display never came back.
- **A driver that fails outright** - is reported as a failed reading and does not stop polling.
- **Lifecycle** - stopping twice is harmless, and starting a stopped poller does not revive it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
