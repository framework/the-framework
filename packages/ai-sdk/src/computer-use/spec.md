Computer use (`./computer-use` subpath): an action vocabulary plus a Playwright executor, wired to Anthropic's native computer-use tool block so an agent can drive a real browser.

## Facts

- The tool name is fixed to `computer` — Claude is trained on that exact identifier.
- Anthropic-only in v1: passing a model at construction validates it eagerly and throws for other providers; without one, non-Anthropic providers silently get a degraded generic tool.
- **Approval is required by default** — computer use is gated unless explicitly opened.
- Executor errors become error-typed action results, not throws; screenshots return content parts with base64 image blocks; per-factory-call closures hold cursor state and the action cap, so the factory is called inside `tools()` for clean per-run state.
- Playwright is typed structurally (`PageLike`) — no Playwright dependency.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
