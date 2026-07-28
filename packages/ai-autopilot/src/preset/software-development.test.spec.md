Tests for the shipped `software-development` built-in preset (#243) — covers bundle shape and mode overrides.

## Facts

- The shipped preset has 2 loops targeting `major-change` + `bug-fix` (non-web events) and ≥5 prompts; every loop-dispatched id resolves to a non-empty shipped body.
- Base major-change chain is `code-review, test-coverage, security-review`; Technical Control mode (`modes: ['technical']`) replaces it with just `code-review` — the variant replaces the base loop rather than adding a third loop.
