The executable the package installs: `tickets`, which the daemon puts on every agent's PATH and which `npx tickets` resolves to in a repository depending on the package. It carries no rule of its own; every rule of the command lives in `../src/cli.ts`.

## Business logic — TL;DR

- **The `tickets` executable** (`tickets`) - hands the shell's arguments, current directory, standard input and output streams to the command and exits with the code the command answers, 1 when the command itself crashes.
