The built-in prompts library (#111) — the stack-aware prompt *bodies* the loop dispatches, shipped as editable markdown data, plus the bridge that turns them into runnable loop prompts.

## TLDR

- `types.ts` — the `Prompt` shape (frontmatter fields + instructions body).
- `parse.ts` / `parse.test.ts` — `parsePrompt`: `SKILL.md`-shaped markdown → frozen `Prompt` (via `@gemstack/ai-skills`' `parseSkillManifest`); `PromptError`.
- `library.ts` / `library.test.ts` — `PromptLibrary` (keyed by dispatch id) and loaders for the shipped `packages/ai-autopilot/prompts/*.md` bundles (`builtinPrompts`, `builtinLibrary`, `loadPromptsFrom`).
- `bridge.ts` / `bridge.test.ts` — `Prompt` → `LoopPrompt`: decisions briefing (#112) prepended to instructions, event rendered to task text, fresh agent built per pass via an injected `MakePromptAgent`; `loopPromptsFor` is the turnkey wire for `new LoopEngine({ prompts })`.
- `index.ts` — barrel.

## Facts

- Contract with `../loop/policy.ts`: the shipped bundles register bodies under the canonical `LOOP_PROMPTS` ids (e.g. `review-thorough.md` sets `loopId: review`) so `defaultLoops()` resolves out of the box; `library.test.ts` guards this.
- Content vs execution split: this directory owns *what* a prompt says (data, community-editable via PR); the loop owns *when* it runs; the agent factory injected into the bridge owns *how* (model, tools).
