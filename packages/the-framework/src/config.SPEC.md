The per-repo defaults every agent starts from, persisted in a small YAML file (`the-framework.yml`) so a project's way of being built — its prompt switches, and what happens when an agent finishes — travels with the code instead of being retyped each time.

## Flows

- The file is read from the workspace root; a missing one yields nothing, and a malformed one is a warning and nothing.
- Every key it declares is parsed, layered under any explicit flag, and narrated back from one canonical list.
- Most keys are checked by type. The one whose values come from a closed set — how far a finished agent publishes itself — is checked by value, so an unknown rung is refused by name.
- Only today's spelling of a key is read: a key a rename retired is an unknown key, and unknown keys are ignored.

## Rationales

- One key list drives parsing, layering and narration alike, so a new setting is declared once instead of added in three places.
- A setting spells its key and its polarity the same way here as everywhere else, so crossing the file boundary is a copy rather than a rename plus a negation.
- The publish rung is checked by value because silently ignoring a typo there would leave a repo that meant "keep it local" publishing.
- A retired spelling is ignored rather than translated: those settings stop applying until someone rewrites the file by hand, which is the whole of this project's migration story.
- A bad config must never fail an agent, so a malformed file degrades to nothing rather than to an error.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
