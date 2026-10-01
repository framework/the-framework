The executable the package installs: `orchestration`, which `npx orchestration` resolves to in a repository depending on the package. It carries no rule of its own; every rule of the command lives in `../src/cli.ts`.

## Business logic — TL;DR

- **The `orchestration` executable** (`orchestration`) - hands the shell's arguments, working directory, environment and output streams to the command and exits with the code the command answers, 1 when the command itself crashes.
