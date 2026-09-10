Runs the framework package's compiled test suite, the `dist-test/` output of the test build, with Node's built-in test runner against a throwaway configuration home, so that no test can ever read the machine's real registry [1] or the daemon's state file. A fresh temporary directory is created and set as the configuration home (`XDG_CONFIG_HOME`) for the whole suite, and removed again when the suite ends, whatever the outcome.

## Glossary

[1] registry: `~/.the-framework.json`, where the user's dashboard settings are kept and which also lists the projects; it lives under the configuration home instead when one is set, which is what lets this script hide it.

## Business logic — TL;DR

- **An isolated configuration home** - every test run gets its own empty configuration directory, because a test that finds the developer's live daemon there attaches to it and hangs until it times out, which reads as a false failure.
- **What runs** - the compiled tests under `dist-test/`, each allowed 60 seconds, with any extra command-line arguments passed through to the test runner.
- **How a failure is reported** - the runner's own output is shown as it happens, and the script exits with the runner's exit code, or with 1 when the runner was killed by a signal or could not start, so `pnpm test` fails.
