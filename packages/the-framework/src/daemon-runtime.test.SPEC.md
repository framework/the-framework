Covers the wait applied when a Resume races a just-finished run's exit: a free slot returns at once, a leg still calling itself running is a real collision and is not waited on, a finished leg is waited out within a bounded grace period, and an in-flight or failed retirement never breaks the continuation awaiting it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
