What the tests cover, the run's lock on a real repository with the live pids faked:

- **One holder at a time** - a free lock is taken and names its taker; taking it again with the same pid goes on at once; a second process waits while the holder is alive and takes the lock over once the holder is dead; a release by a pid that no longer holds it leaves the lock as is; the holder's release removes the file; the repository's working tree stays clean throughout.
- **The hand-over** - a hand-over from a pid that does not hold the lock changes nothing; the holder's hand-over rewrites the lock with the run's process's pid, and that process then takes the lock at once, finding its own pid there.
