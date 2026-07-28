`SkillfulAgent` — an `@gemstack/ai-sdk` `Agent` base class that composes declared skills onto the agent's base identity, tools, and middleware.

## TLDR

- Subclasses implement `baseInstructions()` (abstract) and optionally override `skills()`, `baseTools()`, `baseMiddleware()` (all default to empty).
- `instructions()` / `tools()` / `middleware()` — the hooks ai-sdk actually reads — are "sealed finals" (by convention, not enforced) delegating to `composeInstructions`/`composeTools`/`composeMiddleware`; overriding them directly silently drops skill composition, so override the `base*` hooks instead.
- Skills must be loaded before the agent runs: loading is async (file IO + tools-module import) while these hooks are synchronous — load once at module init and return the loaded objects from `skills()`.

## Facts

- Own tools stay authoritative on name collisions (colliding skill tools get namespaced) and own middleware runs before skill middleware — semantics inherited from `compose.ts`.
