The escape hatch for companies that must route model traffic through their own LLM gateway.

When a gateway speaks a wire format unlike any built-in provider, an app subclasses a template here: the template owns the transport — requests, plain and streaming responses, cancellation, error reporting — and the app describes only the gateway's dialect (auth, request shape, response and stream decoding). The result behaves like any other provider in the SDK. Gateways that are OpenAI- or Anthropic-compatible never need this; they just point the built-in driver at a different address. The directory ships its own stream framing because the built-in providers all stream through vendor SDKs, leaving nothing to reuse.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
