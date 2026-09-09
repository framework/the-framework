The table of every call the daemon answers by name, plus the live event stream [1] as a separate subscription. The table is built from what the read, control, projects, preferences, quota and devices modules export, so an exported call is reachable under exactly its own name and nothing has to be registered by hand; the mount that serves them is `dashboard/rpc-serve.ts`.

## Glossary

[1] event stream: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.

## Business logic — TL;DR

- **The name is the export** - every function those modules export is a call under that name, so a call cannot ship exported yet unreachable, which the browser would only ever see as a bad request.
- **Only real names answer** - the table inherits nothing, so a request naming a property every JavaScript object carries (`constructor`, `toString`, `valueOf` and the like) is "not found" like any other name that is not a call, instead of running something.
- **The stream is not a call** - the live event stream is a subscription the mount serves on its own endpoint; it is exposed beside the table, not in it.
