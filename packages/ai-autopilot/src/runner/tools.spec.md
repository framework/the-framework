`runnerTools(session, opts)` — the bridge between the runner seam and the agent layer: exposes a booted `RunnerSession` to an ai-sdk agent as sandbox tools.

## TLDR

- Always: `read_file`, `list_files`. With `write` (default true): `write_file`, `remove_file`. With `exec` (default true): `exec`, plus `start_server` when the session has `start`. `preview` whenever the session has `preview`.
- Tools are `toolDefinition({ name, description, inputSchema: zod }).server(handler)`, with `modelOutput` renderers keeping model-facing text compact (`wrote <path>`, `exit <code>\n<stdout>…`, the preview URL).
- `opts.prefix` namespaces every tool name (`sandbox` → `sandbox_exec`) for personas that already have a same-named tool.

## Decisions

- Capability is detected, not assumed: `preview`/`start_server` are included only when the session defines the corresponding member.
- `start_server` rides the `exec` toggle — `exec: false` yields a read-only surface (inspect files + preview, no command execution of any kind).
