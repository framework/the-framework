Tests of the `the-framework` command (`cli.ts`).

Covered:
- The command keeps four options and no verbs: `--help`, `--version`, `--port` and `--host` parse; `--agent`, any other option and any bare word are usage errors, and so is a `--port` that is not a number.
- An unknown option, a missing `--host` value and a bad `--port` are each reported.
- The version is the real package version, never the failed-read placeholder, and `--version` prints it.
- `--help` prints the usage and exits 0; a usage error exits 2; the retired flags and verbs (`--daemon`, `stop`, `doctor`, `maintain`, `worktrees`, `prompt`) exit 2.
- The startup footer prints the help pointer and the version, offers no `framework stop` and no positional build command, prints the version before npm answers and announces a newer release after, and prints nothing extra when npm cannot be reached.
