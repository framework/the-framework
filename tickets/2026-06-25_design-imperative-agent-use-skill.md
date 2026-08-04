Priority: 2
Topics: [enhancement]
GitHub: [#13](https://github.com/gemstack-land/the-framework/issues/13)

# Design: optional imperative agent.use(skill) runtime composition

## TLDR

An optional imperative `agent.use(skill)` API (plus likely `agent.forUser(id).use(...)` / `agent.continue(convId).use(...)`) for attaching skills at runtime, after construction. Design-only spin-out of #8, which made the declarative `skills()` class method the primary composition API.

## Why it matters

Runtime composition would enable per-request, per-user, and per-conversation skill sets that a class can't know at definition time. It is deferred because it breaks the declarative class idiom, introduces mutable agent state (precedence/ordering get harder), and isn't needed for progressive disclosure (declarative `skills()` already loads lazily). The open design points (collision precedence, immutability via derived agents, interaction with `forUser()`/`continue()`) are recorded here for when demand appears.

## Source

Imported from GitHub issue [gemstack-land/the-framework#13](https://github.com/gemstack-land/the-framework/issues/13), created 2026-06-25, labels: `enhancement`, `priority: low`.

### Original description

Spun out of #8 (Q4). #8 decided the **primary** composition API is a declarative `skills()` class method (mirrors `tools()`/`middleware()`); the agent's own `instructions()`/`tools()` are authoritative and skills augment + yield on conflict; progressive disclosure is handled lazily by the runtime.

This issue tracks an optional **imperative `agent.use(skill)`** runtime-composition API as an *additional* path later.

## Idea
Allow attaching skills at runtime, after construction:
- `agent.use(skill)` for conditional/dynamic composition (e.g. load a skill based on the incoming request or user).
- Likely also `agent.forUser(id).use(...)` / `agent.continue(convId).use(...)` for per-conversation skill sets.

## Why someone might want it
- Compose skills based on runtime conditions the class cannot know at definition time.
- Per-user / per-conversation skill sets.

## Why it is deferred (not in #8)
- Breaks the declarative class idiom that the rest of `Agent` follows.
- Introduces mutable agent state (precedence/ordering rules get harder).
- Not required for progressive disclosure - the declarative `skills()` set already loads lazily at runtime.

## Open design points (if built)
- Precedence when a runtime-added skill collides with a declared one (last-wins? declared-wins?).
- Immutability: does `use()` return a derived agent rather than mutating in place?
- Interaction with `forUser()`/`continue()` scoping.

## Acceptance (if built)
`agent.use(skill)` composes a skill at runtime with the same merge/precedence semantics as declarative `skills()`, without mutating shared agent state in a surprising way. Declarative `skills()` remains the documented default. Tests prove parity + the scoping rules.

Gated on the same family alignment as #8; design-only for now.
