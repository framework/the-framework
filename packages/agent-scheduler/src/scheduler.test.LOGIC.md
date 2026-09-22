What the tests cover, with the spawn and the CLIs' answers faked:

- **The detached start** - `run --detach` writes the running marker with the command and the host and no pid, asks for the run's process with the id, the command, the prompt and the state's model (or the given one), and answers the id, the command, the driver and the model at once; a plain prompt's command is its first word, and a prompt that is a schedule line's name (`/triage quick`) is filed under that line while `/triage` alone is filed under `triage`.
- **The detached start on Codex** - the marker and the spawned run name Codex and no model, though the state names one; a model given by hand is passed on; a start with a follow-up has it on the marker's mark from the start and passes it to the spawned run.
- **The detached continuation** - `run --detach --resume` spawns the continuation of a recorded run with the text or the answer it was given, and answers that run's id; a run the project has no record of is refused and nothing is spawned; the spawned command line carries the text as its argument, or the answer and the model as options.
- **The spawned run's command line** - the model, the driver and the follow-up (`--then`) are named only when the run has them.
- **The coding agent** - a run's Codex has full access and the run's id as `AGENT_ID` in its environment; a run's Claude Code is Claude Code.
- **A resume** - an ended run recorded on Codex is resumed on Codex, asked for by the record's name, and with no model named at the start nor at the resume.
- **Can a run start here** - a ready coding agent gives no problem and no warning, on Codex too, and only the coding agent's CLI is probed; a logged-out Claude Code is a problem naming `claude auth login`.
