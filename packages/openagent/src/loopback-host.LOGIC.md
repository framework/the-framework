Decides what counts as local, for the daemon deciding whether a bind needs the shared token and for the dashboard rejecting a request whose `Host` header names another machine: `localhost`, the IPv6 loopback (`::1`, also in its bracketed form `[::1]`) and every address in the whole `127.0.0.0/8` range are local; a bind-all address (`0.0.0.0`, `::`), a routable address, an empty host, and a name that merely begins with `127.` are not. The name matters because `127.evil.com`, the rebound host a DNS-rebinding attack presents, resolves to the loopback, so a prefix test would hand it the token gate. The host a `Host` header names is read with its port dropped and an IPv6 literal's brackets kept.

## Business logic — TL;DR

- **Local means an address that never leaves the machine** - `localhost`, `::1`, `[::1]` and every `127.x.x.x` address, matched as a whole address so that a registrable name starting with `127.` is refused.
- **A Host header names a host, not a port** - `127.0.0.1:4200` reads as `127.0.0.1` and `[::1]:4200` as `[::1]`; splitting at the first colon would mangle the IPv6 form.
