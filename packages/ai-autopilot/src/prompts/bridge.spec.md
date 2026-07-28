Bridges data `Prompt`s into runnable `LoopPrompt`s: composes instructions with the decisions briefing, renders the event into task text, and builds a fresh agent per pass via an injected factory.

## TLDR

- `promptInstructions(prompt, {ledger})` — prepends `decisionBriefing(ledger)` (the ideas already rejected, from #112) to the prompt body; just the body when no ledger or nothing rejected.
- `renderTask(event)` — `Change kind: ...` + optional `Summary:` + optional bulleted `Files touched:` list.
- `toLoopPrompt(prompt, makeAgent)` — a `LoopPrompt` carrying the prompt's id and `passes`; each pass calls `makeAgent(ctx)` with a `PromptAgentContext` (prompt, event, pass/passes, ledger, composed `instructions`) and prompts the returned agent with `renderTask(event)`, returning `response.text ?? ''`.
- `loopPromptsFor(libraryOrList, makeAgent)` — materializes a whole `PromptLibrary` (or prompt list) into loop prompts, the turnkey wire so `defaultLoops()` ids resolve to real bodies.

## Decisions

- `makeAgent` is called fresh on every pass — that is the point: a reset context per pass. The factory is responsible for attaching tools (e.g. `runnerTools(session)`) and setting `ctx.instructions` on the agent; the bridge only composes and prompts.

## Flows

- `pass: promptInstructions(prompt, ledger) → makeAgent({...ctx, instructions}) → agent.prompt(renderTask(event)) → text`
