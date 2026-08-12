The built-in loop policy for web apps: which kinds of change trigger which chains of follow-up prompts.

## TLDR

- A major change runs review, then code quality, then security.
- A new user-facing flow runs QA, then UX.
- A production check runs the production-grade gate — the verdict prompt bootstrap's finishing loop repeats against.
- The policy is plain data naming prompts by id only (their bodies live in the prompts library), so it can be extended with your own loops or replaced wholesale.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
