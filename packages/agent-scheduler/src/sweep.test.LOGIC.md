What the tests cover, against a real repository with an origin and an `agent-data` branch, the live card and diary written as a run's session leaves them:

- **A dead run of this machine** - a checkout whose live card says `running` and whose lock no live process holds is ended, recorded `failed` with what the agent said and `its process died before the run ended`, and reclaimed; one on this machine whose lock a live process holds, and a dead-looking one on another machine, are left `running`.
- **An ended, unrecorded run; a waiting one** - a checkout whose card says the run ended is recorded as it ended and reclaimed; one whose card says `waiting` is recorded and kept, for the answer.
- **A marker with nothing behind it** - this machine's marker with a spawn stderr file is recorded `failed` with that stderr in the detail; one with no stderr is recorded `stopped`; another machine's marker stays `running`.
- **A run still booting** - a marker with no pid, whose lock a live process holds and whose checkout is not there yet, is left alone, and the project stays clean.
- **A run being resumed** - a run whose lock a live process holds, its record `running` again and its kept checkout's card still `waiting`, is neither recorded, reclaimed nor kept: the record stays `running`.
