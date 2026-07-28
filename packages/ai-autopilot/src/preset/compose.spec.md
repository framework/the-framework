Merge several `DomainPreset`s into one under a new label (`composeDomainPresets`) and pick one by name (`selectPreset`) — the mechanism that makes presets-of-presets fall out.

## TLDR

- `composeDomainPresets(meta, ...presets)` — result is itself a `DomainPreset` (via `defineDomainPreset`), so composition nests.
- `selectPreset(presets, name)` — find by `name` or `undefined`.

## Decisions

- Loops concatenate in preset order — safe because the loop engine already de-dupes the prompt ids a chain resolves to, so overlapping loops are harmless.
- Prompts merge by `id` with later presets winning (an overlay can override a shared body), then come out sorted by id for a stable result.
- `defaultEvent`: the last preset that declares one wins; a later preset without one does not clear an earlier default; none declared → the field is absent.
