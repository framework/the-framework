Abstract base class an MCP server extends: declares tool/resource/prompt classes, holds the instance-scoped DI resolver, and fans out server-initiated notifications to attached SDK sessions.

## TLDR

- Subclasses declare `protected tools/resources/prompts` as arrays of class constructors (not instances); the runtime instantiates them.
- `metadata()` merges `@Name`/`@Version`/`@Instructions` decorator metadata with fallbacks: class name, `'1.0.0'`, no instructions.
- Constructor takes `{ resolver? }`; stored in a private field, read by the runtime via `@internal _resolver()` and threaded to primitive construction + every `@Handle` call site.
- `attachSdk(target)` registers a per-session notification target and returns a detach function; `attachedCount()` exposed for tests.
- `notify(method, params?)` pushes a notification to every attached session; typed helpers: `notifyResourceUpdated(uri)`, `notifyResourceListChanged()`, `notifyToolListChanged()`, `notifyPromptListChanged()`.
- `introspect()` — public enumeration of the registered classes (constructors) without starting a session; the supported alternative to `@internal` `_tools()/_resources()/_prompts()`.

## Decisions

- `_attached` is lazy-initialised inside `attachSdk` so subclasses need not call `super()`; kept on the instance (not module-private) because the runtime in another file must attach/detach.
- `notify()` swallows per-target errors: one dead transport must not block the others, and logging would spam during normal disconnects — the runtime's session-close handler detaches soon after.
- `introspect()` returns constructors so inspectors/tooling can resolve or construct them with their own DI (added in 0.2.0 to free bindings from internal accessors).

## Facts

- Notification wire methods: `notifications/resources/updated` (with `{ uri }`), `notifications/{resources,tools,prompts}/list_changed` (no params — the params key is omitted entirely, not sent as `undefined`).
- `McpNotificationTarget` is just `{ notification(n): Promise<void> | void }` — the SDK `Server` satisfies it structurally.
