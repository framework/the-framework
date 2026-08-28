Where the `branches` executable lives, for a caller that puts it on a spawned process's PATH: a daemon does so for every agent it starts on its machine, so the agent's shell finds the command by name (an agent running on a GitHub runner or in a cloud sandbox is started elsewhere and gets no such PATH). The directory sits beside the compiled code, so the same path holds from the monorepo and from an installed package.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
