The executable the package installs: `agent-scheduler`, which `npx agent-scheduler` resolves to in a repository depending on the package, and which the tool itself spawns for the scheduler's process as `start --foreground`; the runs are `agent-runner`'s executable. It carries no rule of its own; every rule of the command line lives in `../src/cli.ts`.

## Business logic — TL;DR

- **The `agent-scheduler` executable** (`agent-scheduler`) - hands the shell's arguments, current directory and output streams to the command line and exits with the code it answers, 1 when the command line itself crashes.
