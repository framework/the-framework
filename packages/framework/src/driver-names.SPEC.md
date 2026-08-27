The driver vocabulary: which coding-agent CLIs the user can pick, how each is named on screen, and how a finished agent's record maps back to the driver that was picked.

## Business logic — TL;DR

- **The drivers a user can pick** - Claude Code and Codex, in that order wherever a surface lists them; the labels shown in sentences and on buttons are "Claude Code" and "Codex".
- **Driver versus implementation** - the driver is the user's choice of coding-agent CLI; the implementation recorded on an agent's `agent.json` is the concrete thing that ran it, and one driver has several because it can run in several places. The set of implementation ids is the `agent-driver` package's; this module owns the choice and the mapping back to it.
- **Every place Claude runs is still the `claude` driver** - the local CLI, the cloud session, and the GitHub Actions runner all collapse back to Claude Code; where the agent ran is its run target, not its driver.
- **An unclaimed implementation has no driver** - a record written by the fake driver, or by a newer version of The Framework, maps to no driver at all rather than being guessed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
