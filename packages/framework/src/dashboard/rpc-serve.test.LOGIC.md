What the tests cover, calling the RPC mount over real HTTP (the same-origin and rebound-`Host` guards are covered through the whole server in `server.test.ts`):

- **A malformed Host is answered** - a request whose `Host` header is empty or contains a space gets an HTTP answer instead of ending the daemon, and the mount is still serving afterwards.
- **Every exported RPC is callable by its name** - the registry is built from the RPC modules' exports, so the reads and sends the dashboard uses (projects, agents, stop, preferences, quota, checking devices) are all present without a hand-kept list that could leave one out.
- **A call by name** - `POST /_rpc/<name>` with a JSON array of arguments reaches its handler, and whatever the handler answers, a refusal included, comes back as JSON under `ret` with status 200.
- **An unknown name is 404** - the answer names the missing RPC ("no such RPC: <name>"); the call neither hangs nor crashes anything.
- **Inherited members are not RPCs** - `constructor`, `__proto__`, `toString`, `valueOf` and `hasOwnProperty` are 404 like any unknown name, never answered with the caller's own payload and never a 500.
- **A throwing RPC** - is answered 500 with the failure's message under `error`, and the mount is still serving afterwards.
- **Outside the prefix** - a request for a path outside `/_rpc` is declined by the mount so the static handler gets it.
- **The live event stream** - for an unknown project the stream answers 200 with the Server-Sent Events content type and ends at once with nothing in it, which a client reads as "done" rather than "lost"; an agent whose events come from an in-memory source, which is how a relayed agent's events arrive, is streamed one frame per event in order.
