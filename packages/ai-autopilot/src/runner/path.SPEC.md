The shared workspace path rules: every path is treated as relative to the workspace, and any path that would climb out of it is rejected — the guard that keeps an agent's reads and writes inside its own sandbox.

## Rationales

- One shared implementation keeps the fake honest: if the test double drifted from the real runners on escape handling, tests would pass against behavior production does not have.
- The local-machine runner deliberately uses its own check instead — it has a real directory to resolve against, which also catches escapes the host filesystem would resolve differently.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
