The per-repo defaults every agent starts from, persisted in a small YAML file (`the-framework.yml`) so a project's way of being built — its preset, modes, and what happens when an agent finishes — travels with the code instead of being retyped each time.

## TLDR

- One canonical key list drives parsing, layering and narration alike, so a new setting is declared once and flows through everywhere.
- A setting spells its key and its polarity the same way here as everywhere else, so crossing the file boundary is a copy rather than a rename plus a negation — the one key that did neither had three separate comments apologising for it.
- Most keys are checked by type; the one whose values come from a closed set is checked by value instead, so a mistyped rung of the publish ladder is refused by name rather than silently ignored — a repo that meant "keep it local" must never end up publishing because of a typo.
- Only today's spelling of a setting is read. A file still using an older one — the three booleans the publish ladder replaced, or the earlier name of the mode key — is not translated: those settings simply stop applying, until someone rewrites the file by hand.
- A missing file yields nothing; a malformed one is a warning and nothing — a bad config must never fail an agent; explicit flags override whatever the file says.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
