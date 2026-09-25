The executable the package installs: `discord`, which `npx discord` resolves to in a repository depending on the package. It carries no rule of its own; every rule of the command lives in `../src/cli.ts`.

## Business logic — TL;DR

- **The `discord` executable** (`discord`) - hands the shell's arguments, environment and output streams to the command and exits with the code the command answers, 1 when the command itself crashes.
