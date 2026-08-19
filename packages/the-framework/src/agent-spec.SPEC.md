The dashboard's process API to an agent it spawns: a JSON blob on a temp file, not a command line.

## TLDR

- An agent's whole configuration — prompt, kind, checkout, and every option the launcher and Settings decide — travels as one JSON file, handed to the child as `--agent <path>`.
- JSON has a real `false`, so an option that defaults on can simply be off. The paired `--x` / `--no-x` spellings that argv forced, and the tri-state resolution behind them, do not exist here.
- The spec is consumed, not merely read: the child removes the file — and the private directory made for it — once it has it, so a device token carried in the options never outlives the agent that used it and nothing accumulates per session. The spawner also removes the spec when its child ends, which is a no-op after a consumed one and the cleanup for a child that failed to spawn or died before reading it. Only a directory the framework verifiably made — the right name, directly in the configured spec home — is ever removed whole, so neither a hand-written spec nor a user's own directory that happens to share the name goes with the file.
- Because the dashboard is the only writer, an invalid combination is never constructed, and the child validates only that the file is a spec at all.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
