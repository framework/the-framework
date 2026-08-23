Assembles the dashboard's call table: every read and write the browser can invoke by name over `POST /_rpc/<name>`, collected from the surface's modules (reads, steering, projects, preferences, quota, devices). Served in-process by the daemon, so a Start from the dashboard reaches the daemon's own agent start directly.

## Business logic — TL;DR

- **Exporting is registering** - the table is built from the modules' own exported functions, so a call's name is its export name; a function cannot be exported yet forgotten in the table (the failure that once shipped a feature answering nothing but an error, because a hand-kept registration list missed it).
- **A name that is not an RPC gets a 404** - the name is a path segment off an unauthenticated request, and the table has no object prototype behind it: with one present, names like `constructor`, `__proto__`, or `toString` resolved to built-ins and were answered or invoked, instead of getting the 404 any non-RPC name must get.
- **The live event stream is a subscription, not a call** - it is exposed separately from the table and served as its own endpoint (`GET /_rpc/events`).

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
