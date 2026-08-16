The dashboard's process API to an agent it spawns: a JSON blob on a temp file, not a command line.

## TLDR

- An agent's whole configuration — prompt, kind, checkout, and every option the launcher and Settings decide — travels as one JSON file, handed to the child as `--session <path>`.
- JSON has a real `false`, so an option that defaults on can simply be off. The paired `--x` / `--no-x` spellings that argv forced, and the tri-state resolution behind them, do not exist here.
- The spec is consumed, not merely read: the child removes the file once it has it, so a device token carried in the options never outlives the agent that used it.
- Because the dashboard is the only writer, an invalid combination is never constructed, and the child validates only that the file is a spec at all.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
