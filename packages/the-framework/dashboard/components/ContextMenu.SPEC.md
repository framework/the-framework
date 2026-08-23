The Context picker on the agent launcher: a dropdown where the user narrows what the agent should focus on — other registered projects, plus individual files.

## Glossary

- **Context** - the repos and files the user hands an agent to start from.

## Business logic — TL;DR

- **Folded away until asked for** - the picker is a dropdown labelled "Context", so an unused Context costs no space on the launcher; when something is picked, the trigger carries a short summary of it ("2 projects · 1 file").
- **Projects narrow focus, they don't restrict access** - every registered project other than the current one can be ticked into the Context, each showing its repo path; the wording states plainly that the agent can still reach every repo and that ticking only narrows its focus. With no other project registered, the group says so.
- **Files come from elsewhere and are only managed here** - the files picked by a `#` mention in the prompt or by the right-rail Files tree are listed here and can be dropped one by one; when none are picked, the group points the user at those two ways of adding them.
- **Frozen while the launcher is busy** - the whole picker stops accepting changes while the agent is being started.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
