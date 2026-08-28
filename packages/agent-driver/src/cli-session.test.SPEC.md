What the tests cover: running one turn of a wrapped coding-agent CLI. The CLI's output is turned into driver events as it arrives and the turn ends with the CLI's own result. A CLI that exits before it ever reads the prompt — including with a prompt too large to fit in one write — fails that turn cleanly and never brings the calling process down with it. A turn the user stopped reports itself as stopped and stays silent afterwards: the killed process reporting its own exit a moment later produces neither a result nor a failure.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
