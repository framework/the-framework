The daemon's bookkeeping for app previews: one live preview per project — plus one per session that asks — kept alive across requests and torn down with the daemon.

## TLDR

- Opening is idempotent: an already-running preview hands back its URL, and a preview that stops serving (stopped, crashed, or killed) is evicted immediately so status never reports a dead URL.
- A session's preview serves that session's own checkout, not the project's — otherwise you would be shown code the session never wrote.
- In a multi-app repo, the app last served is remembered per project, so re-serving picks it again without asking.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
