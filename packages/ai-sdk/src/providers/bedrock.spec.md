AWS Bedrock provider — v1 supports only Anthropic Claude models on Bedrock, reusing `anthropic.ts` conversion helpers over the AWS `InvokeModel` / `InvokeModelWithResponseStream` API.

## TLDR

- `BedrockProvider` (name `'bedrock'`) → `BedrockAdapter`; the adapter constructor throws a clear error for non-Anthropic model ids (points to the issue tracker for other families).
- `buildAnthropicBody()` mirrors the native Anthropic Messages body minus `model` (Bedrock takes modelId in the command) plus required `anthropic_version: 'bedrock-2023-05-31'`; reuses `splitSystemMessages`/`toAnthropicMessages`/`toAnthropicTools`/`applyCacheTo*` from `anthropic.ts`.
- Streaming decodes each `event.chunk.bytes` (JSON-wrapped Anthropic events, 1:1) and feeds it through the shared `mapAnthropicStreamEvent`.
- `@aws-sdk/client-bedrock-runtime` is a dynamic import behind `lazyClient` (optional dependency).

## Decisions

- No credentials accepted by default in `BedrockConfig` — auth uses the standard AWS credential chain (env vars, IAM roles, `~/.aws/credentials`) so the same code works in dev and prod; explicit `credentials` exists only for niche multi-account cases.
- Other Bedrock model families (`meta.`, `amazon.`, `cohere.`, `mistral.`, `ai21.`) fail loudly at adapter construction instead of mis-converting.

## Facts

- `isAnthropicOnBedrock()` accepts prefixes `anthropic.`, `us.anthropic.`, `eu.anthropic.`, `apac.anthropic.` (cross-region inference profiles).
- Abort is passed as `{abortSignal}` in the AWS SDK's `client.send()` options (not `signal`).
- Model strings look like `bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0`.

## Flows

- generate: `buildAnthropicBody()` → `InvokeModelCommand` → `client.send()` → `JSON.parse(TextDecoder(response.body))` → `fromAnthropicResponse()`.
- stream: `buildAnthropicBody()` → `InvokeModelWithResponseStreamCommand` → per event decode `chunk.bytes` → `mapAnthropicStreamEvent(decoded, state)`.
