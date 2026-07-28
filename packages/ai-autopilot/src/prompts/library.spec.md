`PromptLibrary` — prompts keyed by dispatch id with lookup helpers — plus loaders for the package's shipped `prompts/` directory.

## TLDR

- `PromptLibrary`: `get(id)`, `all()` (sorted by id for stable order), `ids()`, `byEvent(kind)` (prompts targeting a loop event), `add(prompt)` (add or replace, e.g. a project's own body), `size`.
- `builtinPromptsDir()` — the shipped `prompts/` resolved via `import.meta.url` (two levels up from `dist/prompts/library.js`, also correct for `dist-test/`).
- `loadPromptsFrom(dir)` — parse every `*.md` in filename order via `parsePrompt`.
- `builtinPrompts()` / `builtinLibrary()` — the shipped bodies as a list / ready `PromptLibrary`.

## Facts

- Shipped bundles (in `packages/ai-autopilot/prompts/`): `code-quality`, `knowledge-base`, `production-grade`, `qa`, `refactor`, `review-thorough`, `review-tldr`, `security`, `ux`. `review-thorough.md` carries `metadata.loopId: review` (with `passes: 2`), which is how the canonical `review` id from `defaultLoops()` resolves; `review-tldr` stays a standalone id.
- Because the library keys by id, later `add()`s (or a file whose `loopId` collides) replace earlier prompts.
