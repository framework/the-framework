Composes the run's system channel — the built-in #326 system prompt (a template rendered against `TfContext`), context-doc bullets, format specs, user `SYSTEM.md`, and the emit protocols — as pure, node-free code the dashboard can also render in the browser (#520).

## TLDR

- `SYSTEM_PROMPT_TEMPLATE` (#326): the anti-lazy-pill's successor. Two executable layers: `${{...}}` JS fragments evaluated against `TfContext` (#350), and a trailing `# User prompt` heading that splits the system half from the user-prompt slot. Text lives in `prompts/system_prompt.md` (#551) via `prompts.generated.js` — Rom's living doc, changed on #326 first.
- `renderSystemPrompt()`: splits on the *template* before rendering, so a user prompt containing the heading can never move the boundary; eco sections are dropped before rendering so their fragments never evaluate.
- `EcoOptions` (#314): each flag drops one whole section (`autoPlanning` → `### Scope`, `autoResearch` → `### Alternatives`); `autoMaintenance` acts on the on-before-mergeable prompt instead (#556 moved that section out). `dropSection()` is level-aware — dropping a `###` must stop at the next `###` sibling, not swallow the next `##`.
- `CONTEXT_DOCS` (#683): the repo files the agent keeps in context (`knowledge-base/*`, `GOAL.md`, `BUSINESS_LOGIC.md`, `tickets/**.md`, `.the-framework/conversations/**.md`, `TODO_AGENTS.md`); `BUSINESS_KNOWLEDGE_DOCS` is the subset the agent folds knowledge back into at merge (pinned by a test against the on-before-mergeable prompt).
- `CONTEXT_FORMATS` (#1163): the ticket + TODO format specs shipped *inside the channel* rather than as `node_modules/...` paths.
- `systemPromptBlock()`: `Context:` line (#439 dirs) + doc bullets + formats + rendered built-in prompt + user prompt; `composeRunSystem()` (#501) appends the protocols in fixed order: prompt block, browser (#824), AWAIT, hands-off (#1234), topic-bind (#1121), SIGNAL last (#547).
- `topicBindBlock()` (#1121/#1129): the bind protocol plus the registered-project list for topic runs — reading the list IS injecting it into the channel, not a tool the agent calls (`undefined` = registry unwired, `[]` = steer to create).

## Problems

- The format specs used to be `node_modules/@gemstack/the-framework/prompts/*.md` path pointers, which only resolve when the framework is a root dependency of the repo it works on — not for global/npx installs, fresh worktrees, or this repo itself. The spec was unopenable and the governed files drifted (#1163). Carrying the content in the channel keeps the #674 goal (spec rides with the package version, nothing written into the user's repo).
- The two run paths each inlined the channel composition and drifted — that is what dropped the #326 action layer from `--vanilla` builds (#500); `composeRunSystem` is the single assembly path.
- `ECO_SECTION_HEADINGS` entries must match real headings: `dropSection` no-ops on a miss, so a heading rename would silently stop the flag from trimming anything, with no test failure to catch it (a `!includes` assertion passes for free once the heading is gone) — `system-prompt.test.ts` pins each entry.

## Decisions

- Transparent mode (#625) short-circuits to `''` — no framework behavior to signal to, so the agent runs as raw `claude -p`. Stronger than `--vanilla` (`antiLazyPill === false`), which drops the built-in prompt AND the context docs (one boolean drives both, #547 rule 3) but keeps the protocols: they are the *emit contract*, not prompt content.
- Nothing is appended after composition — a run's channel is exactly this, which is what lets the dashboard show the whole prompt before a run starts (#520/#547).
- The `.the-framework/conversations/` path is spelled out rather than imported to stay node-free; a test pins it to the canonical constants.
- Hands-off protocol sits right after the await protocol it amends: gates are taught, then declared unavailable — keeping the emit contract intact for the parser while telling the agent not to park a cloud session on a question nobody attached can answer (#1234).
