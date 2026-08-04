Remote runs on a connected device: the local daemon — never the browser — drives the remote daemon, and mirrors the remote run into a local row (client half here, `relay-endpoints.ts` is the device half).

## TLDR

- Start goes over the remote's relay-start route; events fetch-stream back (NDJSON with a retained partial-line buffer) into a local event stream the dashboard reads over its normal same-origin channel; run-scoped RPCs forward over the relay RPC route.
- Each relayed event folds through the store's own meta reducer, so the local stub mirrors the device row exactly.

## Decisions

- **The token never leaves the two daemons and the browser never talks cross-origin.** Auth is the daemon cookie with no `Origin` header — admitted without the browser-only redirect affordance.
- An unreachable device answers with the same empty shape a failed local read gives, so no caller special-cases a remote run; a 401 mid-stream ends it *cleanly* (a rotated token surfaces as done, not as a lost connection).
- Timeouts encode intent: ping is short (it polls; that's how status dots learn reachability), start medium, RPC long (a relayed push/PR runs over the network on the device).
- The device side strips any nested remote option — a relayed run can never relay onward — and substitutes its own home project id into forwarded calls, so a relayed RPC can only ever address the device's home checkout. The RPC surface is a whitelist; starting runs, previews, and deletes are deliberately off it.

## Facts

- The mirror's maps have two lifetimes: the stream pump dies with the stream, but targets and metas outlive it — a finished remote run's reads/push/PR must still reach the device. A stream that drops without a terminal event settles a still-running stub to stopped.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
