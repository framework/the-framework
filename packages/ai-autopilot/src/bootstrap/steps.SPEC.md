The default implementations of the bootstrap steps, wired onto the package's real primitives: the Supervisor builds, the loop checks and improves.

## TLDR

- The build step runs the Supervisor over the user's intent and forwards its progress into bootstrap's narration.
- The checklist step asks the loop's production-grade prompt for a verdict; no verdict at all counts as a blocker, since the checklist must return one to pass.
- The improve step fires the loop's change events so its review and QA prompts run with fresh context; those prompt agents do the actual fixing.
- Open blockers travel through the loop between passes, so re-checks and improvements target exactly what failed last time.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
