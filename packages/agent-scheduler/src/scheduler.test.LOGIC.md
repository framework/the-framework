What the tests cover, with the spawn faked:

- **The detached start** - `run --detach` writes the running marker with the command and the host and no pid, asks for the run's process with the id, the command, the prompt and the state's model (or the given one), and answers the id, the command and the model at once; a plain prompt's command is its first word.
