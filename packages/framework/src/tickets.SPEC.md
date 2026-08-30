The one wording The Framework asks for a ticket's plan in, and the lookup that names the agent which wrote a plan. The tickets and the agent queue themselves — their format, their branch, and every read and write of them — belong to the `tickets` skill.

## Business logic — TL;DR

- **One wording for asking for a ticket's plan** - "create the ticket's `.plan.md` sibling", built here so every surface that asks — the plan column's agent, a queued plan entry, and the dedupe that recognizes one — carries the exact same sentence instead of copies that drift.
- **The agent that wrote a plan is found from the framework's records** - the newest agent whose ask names that plan (the plan-ask sentence, whether given directly or carried inside a queue drain's prompt) counts as its author; a plan file itself carries no marker, because an agent does not know its own session while it writes. A plan no recorded ask names has no author.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
