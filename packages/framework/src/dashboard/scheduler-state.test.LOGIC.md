What the tests cover, with real state files in throwaway directories:

- **The file as the scheduler writes it** - a state with a pid, a model and a tick that started a run reads as present, on, running when the probe says the pid is alive (the probe is asked exactly that pid), with the model, the spend offset and the tick's decisions and run id; the same file with a dead pid reads as on and not running.
- **A tick with a note, keep-alive and no pid** - carried as they are: off, keep-alive on, the model, not running, the note.
- **What is missing or wrong** - no file, a file that is not JSON, and a JSON list each read as not set up; a tick without a proper list is left out while the rest is read; a decision missing its outcome, and a list entry that is a number, are dropped while a proper decision is kept.
- **The scheduled commands** - each entry of the last tick's schedule reads with this machine's schedule switch when the state holds one (a command its line lists `off` switched on, one its line lists on switched off), else with what its line says; a switch that is not a boolean is ignored; an entry missing `on`, and one that is a number, are left out; every state without a recorded schedule reads with no commands.
- **Every project** - one row per project in the order given, the project's id and name on it, a read that throws giving that project the not-set-up state.
- **The loosest spend offset** - the highest offset named wins, a negative one alone is the answer, states that name none are skipped, and no state naming one (or no state at all) is no answer.
