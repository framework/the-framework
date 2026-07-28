Types for the domain-preset bundle unit (#204, #242): a `DomainPreset` ties `loops` (which chains fire for which change kinds) and `prompts` (the bodies dispatched by id) into one selectable, composable thing.

## TLDR

- `DomainPreset` — frozen `{ name, title, description, defaultEvent?, loops, prompts }`.
- `DomainPresetSpec` — author-facing input for `defineDomainPreset` (everything but `name` optional).
- `DomainPresetMeta` — identity fields for a composed preset (the merge is derived; only the label is new).

## Facts

- `defaultEvent` is the loop event kind a run dispatches by default for this preset (e.g. `bug-fix`); absent means `major-change`; a run may override it.
