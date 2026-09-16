What the tests cover, with real state files in throwaway directories:

- **The file as the scheduler writes it** - a state with a pid, a model and a tick that started a run reads as present, on, running when the probe says the pid is alive (the probe is asked exactly that pid), with the model and the tick's decisions and run id; the same file with a dead pid reads as on and not running.
- **A tick with a note, keep-alive and no pid** - carried as they are: off, keep-alive on, the model, not running, the note.
- **What is missing or wrong** - no file, a file that is not JSON, and a JSON list each read as not set up; a tick without a proper list is left out while the rest is read; a decision missing its outcome, and a list entry that is a number, are dropped while a proper decision is kept.
- **Every project** - one row per project in the order given, the project's id and name on it, a read that throws giving that project the not-set-up state.
