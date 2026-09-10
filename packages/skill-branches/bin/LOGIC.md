The `branches` executable's home: the one file here, `branches`, is what the package registers as the `branches` command, so `npx branches` in a checkout and the PATH the daemon gives every agent both reach it.

## Business logic — TL;DR

- **The executable** (`branches`) - runs the command with the process's arguments, working directory and streams, prints its JSON on stdout and its line for a person on stderr, and exits with the command's code.
