What the tests cover, with the spawn faked:

- **The detached start** - `run --detach` writes the running marker with the command and the host and no pid, asks for the run's process with the id, the command, the prompt and the state's model (or the given one), and answers the id, the command, the driver and the model at once; a plain prompt's command is its first word.
- **The detached start on Codex** - the marker and the spawned run name Codex and no model, though the state names one; a model given by hand is passed on.
- **The spawned run's command line** - the model and the driver are named only when the run has them.
- **The coding agent** - a run's Codex has full access and the run's id as `AGENT_ID` in its environment; a run's Claude Code is Claude Code.
- **A resume** - an ended run recorded on Codex is resumed on Codex, asked for by the record's name, and with no model named at the start nor at the resume.
