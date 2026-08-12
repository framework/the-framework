Turns an application database table with a vector column into an agent tool: the model asks in natural language, the query is embedded, and the closest rows come back ranked by similarity.

## TLDR

- The embedding model must be named explicitly — failing loud beats silently embedding with whatever the app's default provider happens to be.
- An optional scope callback narrows the searched rows with flat filters (tenancy, publication state) before the vector match applies.
- Results pair each row with a similarity score; the model sees a compact per-row text line (customizable), while the structured rows still flow to the UI.
- Requires a database that supports vector queries; anything else fails with a clear message.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
