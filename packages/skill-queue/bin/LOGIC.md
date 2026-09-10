The executable the package installs: `queue`, which the daemon puts on every agent's PATH and which `npx queue` resolves to in a repository depending on the package. It carries no rule of its own; every rule of the command lives in `../src/cli.ts`.

## Business logic — TL;DR

- **The `queue` executable** (`queue`) - hands the shell's arguments, current directory and output streams to the command and exits with the code the command answers, 1 when the command itself crashes.
