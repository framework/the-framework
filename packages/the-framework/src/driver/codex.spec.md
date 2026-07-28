The second real `Driver` (#539): wraps the Codex CLI in non-interactive mode (`codex exec --json`) on the user's own ChatGPT subscription — no API key (#495).

## TLDR

- `CodexSession.prompt` runs one fresh `codex exec --json --skip-git-repo-check --sandbox <policy> -C <cwd>` invocation through the shared `runAgentCli`, with a `CodexJsonParser`.
- `CodexJsonParser` folds the `exec --json` NDJSON dialect (observed on codex-cli 0.144.4): `thread.started` → sessionId, `item.completed agent_message` → text events (last message wins as the turn — earlier ones are progress narration), any `item.started` → `action` (kind only, never arguments), `turn.completed` → usage.
- Differences from Claude Code, all the agent's business: no system-prompt flag (framing is prepended to the prompt, blank-line separated), tokens but no price, no quota read.

## Decisions

- Default sandbox `workspace-write` — the counterpart of Claude Code's `acceptEdits`; `--dangerously-bypass-approvals-and-sandbox` is never passed.
- `--skip-git-repo-check` because Codex otherwise refuses to run outside a git repo, and a workspace may legitimately not be one yet.
- Prompt over stdin, never argv (arg-length limits).
- Usage omits `costUsd` entirely rather than claiming `$0` (#540): the budget cap (#322) gates on a price and so cannot fire here.

## Facts

- Codex usage is OpenAI's Responses-API shape flattened; `input_tokens` is the TOTAL input, cached included (verified empirically: repeating a prompt held it at 12218 while `cached_input_tokens` rose), so `inputTokens` = input − cached. `reasoning_output_tokens` is a subset of `output_tokens` (adding it would double-count). `cacheCreationTokens` is honestly 0 — OpenAI caches implicitly and bills no separate write.
