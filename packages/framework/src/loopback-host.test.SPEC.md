What the tests cover: `localhost` and the IPv4 and IPv6 loopback addresses count as reachable only from this machine, and so does the entire IPv4 loopback range rather than just its first address — a daemon bound anywhere in that range is still local. A name that merely begins with a loopback address, which is the rebound host the guard exists for, is not local; neither is a bind on every interface, a routable address, or an empty host. A stated host is read without its port, and an IPv6 literal keeps its brackets intact.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
