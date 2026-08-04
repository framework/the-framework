The telefunction implementations behind every dashboard RPC — living in *this* package (not the dashboard package) so they can reach the daemon's own closures, and registered under the RPC keys the dashboard client baked at build time.

## Problems

- Telefunc's client derives each RPC key from its *own* source path in the dashboard package (`"/server/reads.telefunc.ts:onRuns"`), but the implementations live here and no Vite build runs over them — so the server cannot discover them by path. `register.ts` re-registers every export under those exact baked keys; the dashboard package keeps thin re-export shims; the key list lives in one constant so a rename is a one-liner.

## Decisions

- **Registration by iteration, not by list**: every function export of the RPC modules is registered under its own export name, so an exported-but-unregistered telefunction is impossible by construction — that failure mode is a bare 400 at runtime with nothing to type-check, and it once shipped a broken feature.
- `context.ts` is the capability pattern: each accessor documents which hosts wire it, and *unset means graceful degradation*, not an error — the public relay gets no preferences (inert), no quota (reports no reading, not zero), no Discord store (refuses the write — a shared host has no business holding one user's bot token). Context must be read before the first `await` (Telefunc exposes it synchronously at the top of a call).
- **Relay transparency**: almost every run-scoped RPC is wrapped in a helper that runs locally or forwards to the run's device, whose unreachable-answer is *the same empty shape a failed local read gives* — no caller special-cases a remote run.
- Run addressing: anything addressed at a run must resolve inside that run's worktree (a run reads and writes there) — or it reads an empty log and steers a run that is not listening.
- The write side (`control.telefunc.ts`) holds the steering rules: the push/PR pair is normalized before storing (PR implies push); Merge is one button over two states (a live run gets a control entry recording the human authorization and merges at its natural end; a finished run's open PR is merged directly); queue/ticket references are resolved server-side off the queue file rather than trusting browser-supplied values; the bridge answer is the one deliberate exception to "steering is a control-log write", because a cloud run has no live local session.

## Facts

- `events.telefunc.ts` streams a run's own journal over a Telefunc channel. A wire-only `stream-sync` marker (never written to any journal) is sent after the on-disk replay, because a reconnecting client cannot tell "replay still streaming" from "the log is genuinely this short" — it used to blank a populated feed and refill it line by line. In-memory sources (relay, device mirrors) send no marker; the client falls back to a grace deadline.
- An unknown project closes the channel immediately, mirroring the read model's empty results rather than throwing at the client.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
