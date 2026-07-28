The `Prompt` type — a parsed, ready-to-use prompt bundle (frontmatter + markdown instructions body) shipped as data.

## Facts

- `id` is the loop dispatch id: `metadata.loopId` or the manifest `name`; `passes` is the fresh-context pass count (default 1); `event` optionally ties the prompt to a loop event kind; `appliesTo` holds stack hints (package names / globs).
- Design intent (module doc): bodies live as `.md` files under the package's `prompts/` directory and are loaded at runtime — nothing executable, so non-core contributors edit prose, not code. Persona (#98) is the *role*; a prompt is the *task*.
