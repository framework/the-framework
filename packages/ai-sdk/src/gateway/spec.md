`@gemstack/ai-sdk/gateway` subpath: template for putting a custom LLM gateway behind the `ProviderAdapter` contract.

## TLDR

- `http-gateway-adapter.ts` — abstract `HttpGatewayAdapter` (Template Method: base owns fetch/JSON/SSE/abort/errors, four abstract hooks own the gateway's wire format).
- `sse.ts` — standalone `parseSseStream` framer the base class streams through.
- `http-gateway-adapter.test.ts` — end-to-end template tests with an example subclass (#1168).
- `index.ts` — re-exports.

## Facts

- Layering rule: only needed for gateways with novel wire formats — OpenAI/Anthropic-compatible gateways should instead override `baseUrl` on the built-in drivers.
