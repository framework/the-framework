Fluent image-generation facade (`ImageGenerator.of(prompt).model(...).generate()`) that resolves a provider's `createImage` adapter through `AiRegistry`.

## TLDR

- Builder knobs: `model`, `size`, `quality`, `style`, `count`, `failover(...models)`.
- `generate()` resolves `provider/model`, errors if the factory lacks `createImage`, and runs through `tryWithFailover` (capability-missing providers count as a failed candidate and are skipped).
- `store(path, storage)` generates, then persists the first image through a caller-supplied `StorageAdapter` — base64 is decoded via `fromBase64`; a `url`-only image is `fetch`ed; neither ⇒ throw. Returns `path`.

## Facts

- No default storage: `store()` throws without an explicit `StorageAdapter` (package bundles no storage impl).
- Failover swallows intermediate errors and surfaces only the last one.
