The browser app the daemon serves — the product's only user interface. A single-page app that is a pure projection of the same files the daemon writes: it reads over `POST /_rpc/<name>`, follows the selected agent live over a server-sent event stream of `.the-framework/events.jsonl`, and steers agents back through the same daemon (Stop, picks, chat, handoff changes).

## Business logic — TL;DR

- **The URL is the selection** - `/` is the cross-project Overview; `/{projectId}` a project's home and launcher; `/{projectId}/{agentId}` one agent, live or replayed from its archive; `/settings` the settings page; `/tickets` the cross-project tickets list, and `/{projectId}/tickets/{slug}` (plus `/plan`) one ticket and its plan.
- **Live and replay render identically** - a running agent and a finished one are the same event-stream projection, so watching now and reading later show the same record.
- **Everything an agent needs from a human happens here** - answering gates, chatting with a running agent, choosing driver/model/run target/handoff, and firing the handoff actions (push, open a pull request, merge).
- **Structure** - `components/` is the view layer, `lib/` the browser-side state and logic, `rpc/` the typed stubs for the daemon's RPC surface (type-checked against the daemon's own signatures, so a renamed RPC is a compile error, not a 404).

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
