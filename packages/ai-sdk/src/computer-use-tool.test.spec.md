Tests for `computer-use/`'s `computerUseTool` factory — model validation, tool shape, schema hint, execute results, per-instance state, and the action cap.

## TLDR

- `isAnthropicLikeModel`: accepts `anthropic/*` and `bedrock/[us.|eu.|apac.]anthropic.*`; rejects other providers, bedrock non-Anthropic families, and OpenRouter-routed Anthropic (goes through the OpenAI SDK, so the native `computer_20250124` block cannot be sent).
- Factory throws `ComputerUseProviderError` (`code: 'COMPUTER_USE_PROVIDER_MISMATCH'`) for non-Anthropic models; validation is skipped/deferred when `model` is omitted.
- Tool carries the `COMPUTER_USE_MARKER` symbol (`isComputerUseTool`), fixed name `computer`, `needsApproval` defaults to `true` (explicit `false` or a per-action predicate honored), and `toSchema()` emits the `computer-use` providerHint with viewport (default 1280×800).
- Execute: screenshots return a one-element `ContentPart[]` image (base64 PNG); text actions return plain strings; executor `{ type: 'error' }` becomes a thrown Error so the agent loop can set `is_error`.
- Cursor state persists across executes of one tool instance but is fresh per instance; `maxActions` (default 50) throws `ComputerUseLimitError` (`code: 'COMPUTER_USE_LIMIT_EXCEEDED'`) per instance.
