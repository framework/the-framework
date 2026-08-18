Decides whether an address is truly local, so the dashboard skips its access token only when the browser never leaves the machine.

## TLDR

- A bind-all or routable address is not local and stays gated behind the shared token.
- A registrable name that merely starts with "127." is rejected — that is exactly the rebound host a DNS-rebinding attack uses to look local.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
