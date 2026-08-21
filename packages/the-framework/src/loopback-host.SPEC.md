Decides whether an address is truly local, so the dashboard skips its access token only when the browser never leaves the machine.

## Flows

- A bind-all address (`0.0.0.0`, `::`) or a routable one is not local and stays gated behind the shared token.
- A DNS name that merely starts with `127.` is rejected — a name someone can register is exactly the rebound host a DNS-rebinding attack uses to look local.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
