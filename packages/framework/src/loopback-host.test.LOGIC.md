What the tests cover:

- **What is local** - `localhost`, `127.0.0.1`, `::1` and `[::1]` are local, and so is every address in the `127.0.0.0/8` range (`127.0.0.2`, `127.1.2.3`, `127.255.255.255`), not only the first one.
- **What is not** - a name that merely starts with `127.` (`127.evil.com`, `127.0.0.1.evil.com`), the bind-all addresses `0.0.0.0` and `::`, a routable address and an empty host are not local.
- **Reading a Host header** - the port is dropped (`127.0.0.1:4200` reads as `127.0.0.1`), a bare name is unchanged, and an IPv6 literal keeps its brackets with or without a port.
