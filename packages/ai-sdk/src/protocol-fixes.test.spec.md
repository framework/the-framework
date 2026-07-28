Regression tests for the 2026-05-21 provider protocol/runtime fixes — Gemini `functionResponse.name`, Buffer-free content decoding, embed caching, and the OpenAI/DeepSeek tool-transcript normalizer.

## TLDR

- Gemini: `toGeminiContents` puts the originating FUNCTION NAME (not the synthetic call id) in `functionResponse.name`, routes parallel results by id, falls back to `"unknown"` for orphan tool messages instead of crashing.
- Buffer-free: `base64ToUtf8` and text-document content parts for Gemini/Anthropic/OpenAI all decode multi-byte UTF-8 with `Buffer` deleted from `globalThis` (browser/RN/Electron-renderer path).
- `AI.embed({cache:true})` reuses the wire result across identical calls (regression: a fresh inner adapter per call defeated caching), keys per model, and `AiRegistry.reset()` clears the embedding cache via the reset-listener hook.
- `normalizeToolTranscript`/`toOpenAIMessages`: drops orphan tool results (the DeepSeek `400 role 'tool' must be a response to a preceding message with 'tool_calls'`), pulls detached results back adjacent to their parent assistant, synthesizes "tool result missing" stubs for unanswered `tool_calls`, leaves well-formed transcripts untouched — asserted via a helper checking both adjacency and full-coverage invariants.

## Facts

- Anthropic tolerates loose tool-message ordering; OpenAI-protocol providers do not — that asymmetry is the reason the wire-level normalizer exists (see docs/plans/2026-06-11-deepseek-tool-transcript-400.md).
