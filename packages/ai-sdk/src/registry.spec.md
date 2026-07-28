`AiRegistry` — process-wide static registry of provider factories, default model, and model catalog; plus `tryWithFailover`, the single-shot failover helper used by the media facades.

## TLDR

- `register(factory)` / `getFactory(name)` / `setDefault('provider/model')` / `getDefault()` / `setModels`/`getModels` / `reset()`.
- `parseModelString` splits on the FIRST `/` → `[provider, model]` (model ids may contain further slashes); throws on no slash.
- Capability resolvers: `resolve` (chat adapter), `resolveReranking`, `resolveFiles`, `resolveVectorStores` (#B8) — each throws a targeted "provider does not support X, use e.g. …" error when the factory lacks the optional `create*` method.
- `tryWithFailover(primary, fallbacks, call)`: dedupes primary out of fallbacks, tries in order, swallows intermediate errors, throws the last one. Simpler than the agent loop's own failover (no telemetry/abort/observer wiring) — meant for Image/Audio/Transcription.

## Problems

- Double-load: a Vite-bundled server inlines the package while provider bootstrap runs from a node_modules copy — two module instances, two would-be stores. Without sharing, every agent call would throw "Unknown AI provider".

## Decisions

- Store routed through `globalThis.__rudderjs_ai_registry__` (defensive migration per the #499 static-state singleton audit; pattern repeated for every process-wide registry in the package).
- `_onAiRegistryReset(fn)` lets adjacent caches (e.g. the facade's embedding-adapter cache) subscribe so `reset()` clears them in lock-step; the listener set also lives on `globalThis`.
