Builds the routing hint that makes OpenAI's automatic prompt caching effective: a stable fingerprint of exactly the prompt regions the agent declared cacheable.

## TLDR

- OpenAI caches long prompts on its own; the only lever it offers is an opaque key that routes same-prefix requests to the same server — the one already holding the cached prefix.
- The key fingerprints only what was marked cacheable — instructions, tools, the first messages — so unrelated conversations don't share routing.
- With nothing marked, no key is sent and caching still happens, just without the routing affinity.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
