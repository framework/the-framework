What the tests cover: the agent's process is held open from the first pending wait until its answer arrives; two overlapping waits (a gate and a live chat message) share a single hold, which is only released by the last of them to settle; a wait that fails releases the hold and still reports its failure to the caller; a new wait after everything settled holds the process again; and the hold really does keep the process alive rather than being decorative.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
