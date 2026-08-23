The security-audit preset: an exhaustive security review of whatever the user named — the launcher asks "what to security-audit" — that both reports and fixes.

## Business logic — TL;DR

- **Exhaustive by instruction** - the agent scrutinizes the entire code for potential security issues and is told to reach 100% coverage.
- **Every aspect gets a verdict** - the agent lists each aspect it considered with its verdict, explaining the ones whose verdict is not obvious.
- **Fixes land one commit at a time** - each security issue found is fixed in its own commit.

## Business logic

### Exhaustive by instruction, and auditable

#### User story

The user wants to be able to tell "nothing was found" apart from "nothing was looked at". A list of everything considered, with a verdict against each, is what makes that difference visible.

#### Business logic

The agent reviews the whole of the named target rather than sampling it, and reports the review as a list of aspects considered, each carrying a verdict and — where the verdict is not obvious — an explanation. Issues are not just reported: each one is fixed, and each fix is a separate commit so it can be reviewed and reverted on its own.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
