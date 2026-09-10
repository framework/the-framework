The skill's command as the agent meets it: `bin/` holds the one executable, `logs`, which the daemon puts on every agent's PATH and which `npx logs` resolves to from the project's dependencies. The executable only bridges the shell to the command's runner in `src/cli.ts`; every rule of the command (what it prints, what it refuses, the exit codes) lives there.

## Business logic — TL;DR

- **The `logs` executable** (`logs`) - the shell's command line, working directory and streams in, the runner's exit code out: 0 for a result, 1 for a refusal or a git failure, 2 for a command line that could not be read; a crash the runner did not handle exits 1.
