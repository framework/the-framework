Decides whether an address is one a browser can only reach from this machine — which is how the daemon knows whether a given bind needs to be gated behind the shared token, and how a request whose declared host has been rebound to point at this machine is rejected.

Loopback means `localhost`, the IPv6 loopback address, or any address in the whole IPv4 loopback range; a bind that listens on every interface, or on a routable address, is not. A *name* that merely looks like a loopback address — for example a registered domain beginning with `127.` — is never accepted, because such a name can be made to resolve to this machine and is exactly what the guard exists to reject. When a request states its host, the port is dropped and the bracketed IPv6 form is preserved intact.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
