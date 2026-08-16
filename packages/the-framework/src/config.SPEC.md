The per-repo defaults every agent starts from, persisted in a small YAML file (`the-framework.yml`) so a project's way of being built — its preset, modes, and what happens when an agent finishes — travels with the code instead of being retyped each time.

## TLDR

- One canonical key list drives parsing, layering and narration alike, so a new setting is declared once and flows through everywhere.
- A setting spells its key and its polarity the same way here as everywhere else, so crossing the file boundary is a copy rather than a rename plus a negation — the one key that did neither had three separate comments apologising for it.
- Most keys are checked by type; the one whose values come from a closed set is checked by value instead, so a mistyped rung of the publish ladder is refused by name rather than silently ignored — a repo that meant "keep it local" must never end up publishing because of a typo.
- The same rule is why the three booleans that ladder replaced are still read: an ignored key does not leave a repo where it was, it lands it on the default, and the default publishes. A file that declined to be published keeps declining until someone rewrites it.
- A missing file yields nothing; a malformed one is a warning and nothing — a bad config must never fail an agent; explicit flags override whatever the file says.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
