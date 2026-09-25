The executable the package installs: `agent-runner`, which `npx agent-runner` resolves to in a repository depending on the package, and which the tool itself spawns for its detached processes (each run as `run <prompt> --id <id> …`, each resume as `run --resume <id> …`). It carries no rule of its own; every rule of the command line lives in `../src/cli.ts`.

## Business logic — TL;DR

- **The `agent-runner` executable** (`agent-runner`) - hands the shell's arguments, current directory and output streams to the command line and exits with the code it answers, 1 when the command line itself crashes.
