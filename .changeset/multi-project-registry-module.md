---
"@gemstack/framework": minor
---

Add the multi-project registry module: reads and writes the list of projects The Framework is installed into, as a small `{id, path, addedAt}` JSON index under the user's config dir. Exposes `projectId`, `registryPath`, `listProjects`, `addProject`, `removeProject`, and an injectable `RegistryFs` seam with a `nodeRegistryFs()` adapter. No daemon or UI wiring yet.
