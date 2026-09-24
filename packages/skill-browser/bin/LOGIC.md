The executable the package installs: `browser`, which `npx browser` resolves to in a repository depending on the package. It carries no rule of its own; every rule of the command lives in `../src/cli.ts`.

## Business logic — TL;DR

- **The `browser` executable** (`browser`) - hands the shell's arguments, current directory, environment and output streams to the command and exits with the code the command answers, 1 when the command itself crashes.
