What the tests cover:

- **A spec round-trips** - what the daemon writes is read back value for value; an explicit option value survives and so does saying nothing, so a handoff left unset stays unset for the repo file to decide rather than reading as off.
- **Reading consumes the spec** - after the read the file is gone and, for a spec The Framework wrote, its whole directory with it, so a device token never outlives the start and no empty directory is left behind per agent.
- **Only The Framework's own directory is removed whole** - a hand-written spec loses only the file, and the directory the user keeps it in survives; a directory that merely carries The Framework's prefix outside the spec home keeps everything but the file.
- **Cleanup when the process never ran** - the spawner's removal takes the spec's directory with the file.
- **What is refused** - content that is not JSON, a spec with no kind and no checkout ("not a session spec"), and a path that does not exist are all refused rather than half-run; a spec without options reads as one with empty options, never as one with none.
- **Where specs are written** - each spec goes into a fresh directory of its own under the spec home, so two concurrent starts never share a file, and it is written as readable indented JSON so an agent that dies at boot can be diagnosed from it.
